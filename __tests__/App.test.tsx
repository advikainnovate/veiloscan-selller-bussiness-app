/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';

function textOf(tree: ReactTestRenderer.ReactTestRenderer) {
  return JSON.stringify(tree.toJSON());
}

async function renderPastSplash() {
  jest.useFakeTimers();
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  expect(textOf(tree)).toContain('BUSINESS');
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(3000);
  });
  jest.useRealTimers();
  return tree;
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('first launch goes from the splash to Get Started', async () => {
  const tree = await renderPastSplash();
  expect(textOf(tree)).toContain('Get Started');
});

test('after Get Started has been seen, the app opens on Seller Sign In', async () => {
  await AsyncStorage.setItem('app.onboarded', '1');
  const tree = await renderPastSplash();
  expect(textOf(tree)).toContain('Seller Sign In');
});
