import { ViewTransition, addTransitionType } from 'react';

export function Gallery({ children }) {
  function next() {
    addTransitionType('next');
  }
  return <ViewTransition>{children}</ViewTransition>;
}

