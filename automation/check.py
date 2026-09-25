"""Validate project registrations and optionally run their reviewed checks.

Standard library only. Metadata validation is NOT a product-quality assessment.
With --run, commands from trusted project.json files execute in each project folder.
"""
from __future__ import annotations

import argparse
from datetime import date
import json
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCE_SUFFIXES = {'.py', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.html', '.rs', '.go', '.java', '.dart', '.kt', '.swift', '.cpp', '.c', '.cs', '.sh', '.vue', '.svelte'}


def text(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f'{label}: a non-empty string is required')
    return value


def iso_date(value: object, label: str) -> None:
    value = text(value, label)
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        raise ValueError(f'{label}: use YYYY-MM-DD')
    try:
        date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f'{label}: invalid calendar date') from exc


def public_url(value: object, label: str) -> str:
    value = text(value, label)
    try:
        parsed = urlsplit(value)
        host = parsed.hostname or ''
        if parsed.scheme != 'https' or not host or parsed.username or parsed.password:
            raise ValueError()
        if host.endswith('.invalid') or host in {'localhost', 'example.com', '127.0.0.1', '::1'}:
            raise ValueError()
    except ValueError as exc:
        raise ValueError(f'{label}: a real HTTPS source URL is required') from exc
    return value


def file_in_project(project: Path, value: object, label: str) -> Path:
    name = text(value, label)
    relative = Path(name)
    if relative.is_absolute() or '..' in relative.parts or '\\' in name:
        raise ValueError(f'{label}: path must stay inside this project')
    path = project / relative
    if not path.resolve().is_relative_to(project.resolve()) or not path.is_file():
        raise ValueError(f'{label}: missing file or path escapes the project: {name}')
    return path


def command_spec(item: object, label: str) -> None:
    if not isinstance(item, dict):
        raise ValueError(f'{label}: command entry must be an object')
    command = item.get('command')
    if not isinstance(command, list) or not command:
        raise ValueError(f'{label}: command must be a non-empty argument array, not a shell string')
    for arg in command:
        text(arg, f'{label}.command')
        if '\x00' in arg:
            raise ValueError(f'{label}: NUL bytes are not allowed')
    timeout = item.get('timeout_seconds', 180)
    if type(timeout) is not int or not 1 <= timeout <= 300:
        raise ValueError(f'{label}: timeout_seconds must be an integer from 1 to 300')


def validate_project(project: Path) -> dict:
    manifest = project / 'project.json'
    if manifest.is_symlink() or not manifest.is_file():
        raise ValueError('project.json: a regular manifest file is required')
    if manifest.stat().st_size > 1_000_000:
        raise ValueError('project.json: manifest is too large')
    try:
        data = json.loads(manifest.read_text(encoding='utf-8'))
    except (ValueError, UnicodeError) as exc:
        raise ValueError('project.json: invalid UTF-8 JSON') from exc
    if not isinstance(data, dict):
        raise ValueError('project.json: root must be an object')
    for field in ('slug', 'title', 'summary', 'problem', 'audience', 'why_now', 'difference', 'monetization_hypothesis'):
        text(data.get(field), field)
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', data['slug']) or data['slug'] != project.name:
        raise ValueError('slug: must be a lowercase kebab-case name matching the folder')
    iso_date(data.get('created_at'), 'created_at')
    file_in_project(project, 'README.md', 'README')
    for field in ('source_files', 'test_files'):
        values = data.get(field)
        if not isinstance(values, list) or not values:
            raise ValueError(f'{field}: at least one code file is required')
        for value in values:
            path = file_in_project(project, value, field)
            if path.suffix not in SOURCE_SUFFIXES or path.stat().st_size == 0:
                raise ValueError(f'{field}: must reference non-empty code, not documentation')
    if set(data['source_files']) & set(data['test_files']):
        raise ValueError('test_files: tests must be separate from application source files')
    limitations = data.get('limitations')
    if not isinstance(limitations, list) or not limitations:
        raise ValueError('limitations: explicitly document at least one real limitation')
    for limitation in limitations:
        text(limitation, 'limitations')
    for field in ('sources', 'alternatives'):
        items = data.get(field)
        if not isinstance(items, list) or len(items) < 2:
            raise ValueError(f'{field}: at least two entries are required')
        urls = set()
        for item in items:
            if not isinstance(item, dict):
                raise ValueError(f'{field}: entries must be objects')
            url = public_url(item.get('url'), field)
            if url in urls:
                raise ValueError(f'{field}: duplicate URL')
            urls.add(url)
            if field == 'sources':
                if type(item.get('primary')) is not bool:
                    raise ValueError('sources.primary: boolean required')
                iso_date(item.get('checked_at'), 'sources.checked_at')
                if item.get('published_at') is not None:
                    iso_date(item['published_at'], 'sources.published_at')
            else:
                text(item.get('name'), 'alternatives.name')
                text(item.get('difference'), 'alternatives.difference')
    if not any(source['primary'] for source in data['sources']):
        raise ValueError('sources: at least one primary source is required')
    setup = data.get('setup', [])
    checks = data.get('checks')
    if not isinstance(setup, list) or not isinstance(checks, list) or not checks:
        raise ValueError('setup/checks: arrays required, with at least one check')
    for item in setup:
        command_spec(item, 'setup')
    for item in checks:
        command_spec(item, 'checks')
        if item.get('kind') not in {'test', 'build', 'smoke'}:
            raise ValueError('checks.kind: use test, build or smoke')
    if not any(item['kind'] == 'test' for item in checks):
        raise ValueError('checks: at least one actual test command is required')
    return data


def discover(root: Path) -> list[Path]:
    directory = root / 'projects'
    if not directory.is_dir():
        raise ValueError('projects directory is missing')
    projects = []
    for path in sorted(directory.iterdir()):
        if path.is_symlink():
            raise ValueError(f'projects/{path.name}: symlinks are not allowed')
        if path.is_dir() and not path.name.startswith('.'):
            projects.append(path)
    return projects


def run_project(project: Path, data: dict) -> None:
    for item in data.get('setup', []) + data['checks']:
        label = item.get('kind', 'setup')
        print(f'[{project.name}] {label}: {item["command"]!r}', flush=True)
        subprocess.run(item['command'], cwd=project, shell=False, check=True,
                       timeout=item.get('timeout_seconds', 180), stdin=subprocess.DEVNULL)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--run', action='store_true', help='execute reviewed project setup/test/build commands')
    args = parser.parse_args(argv)
    try:
        projects = discover(args.root)
        validated = [(project, validate_project(project)) for project in projects]
        titles = [data['title'].casefold().strip() for _, data in validated]
        if len(titles) != len(set(titles)):
            raise ValueError('project titles must be unique; also review semantic duplicates manually')
        if not validated:
            print('No registered projects yet. Repository bootstrap is not a verified product.')
            return 0
        print(f'Validated registration metadata for {len(validated)} project(s). This is not functional verification.')
        if args.run:
            for project, data in validated:
                run_project(project, data)
            print(f'All declared checks completed for {len(validated)} project(s). Review test coverage separately.')
        return 0
    except (ValueError, OSError, subprocess.SubprocessError) as exc:
        print(f'CHECK FAILED: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
