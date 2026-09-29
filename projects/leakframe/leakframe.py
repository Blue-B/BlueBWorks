#!/usr/bin/env python3
"""LeakFrame command-line interface."""
import argparse, sys
from pathlib import Path
from jpegmeta import Scan, inspect_jpeg, strip_privacy_metadata, clean_file, demo_jpeg, format_report, _segment

def main(argv=None):
    p=argparse.ArgumentParser(description="JPEG의 숨은 메타데이터를 로컬에서 확인·제거해")
    p.add_argument("files",nargs="*",type=Path)
    p.add_argument("--dry-run",action="store_true",help="검사만 하고 파일을 만들지 않음")
    p.add_argument("--output-dir",type=Path,help="정리된 파일을 저장할 폴더")
    p.add_argument("--demo",action="store_true",help="가상 JPEG로 기능 데모")
    a=p.parse_args(argv)
    if a.demo:
        sample=demo_jpeg(); cleaned,result=strip_privacy_metadata(sample)
        print("LEAKFRAME · 사진을 공유하기 전 숨은 메타데이터 확인\n"+"─"*52)
        print(format_report("vacation-photo.jpg  [가상 예제]",result,len(sample),len(cleaned)))
        print("\n✓ 이미지 데이터는 다시 인코딩하지 않고 메타데이터 세그먼트만 제거해.")
        return 0
    if not a.files: p.error("JPG/JPEG 파일을 하나 이상 지정해줘")
    if a.output_dir and not a.dry_run: a.output_dir.mkdir(parents=True,exist_ok=True)
    failed=False
    for path in a.files:
        try:
            output=a.output_dir/(path.stem+".clean"+path.suffix.lower()) if a.output_dir else None
            target,result,before,after=clean_file(path,output,a.dry_run)
            print(format_report(path.name,result,before,after))
            if target: print(f"  저장: {target}")
        except (OSError,ValueError) as exc:
            failed=True; print(f"{path}: {exc}",file=sys.stderr)
    return 1 if failed else 0

if __name__=="__main__": raise SystemExit(main())
