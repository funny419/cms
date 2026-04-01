/* global global */
import '@testing-library/jest-dom';
import React from 'react';
global.React = React;

// jsdom은 navigator.clipboard를 기본 제공하지 않으므로 전역 stub을 제공한다.
if (!navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: () => Promise.resolve(),
      readText: () => Promise.resolve(''),
    },
    writable: true,
    configurable: true,
  });
}
