/**
 * @format
 */

import React from 'react';
import ReactTestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import { authService } from '../src/services/auth-service';

jest.mock('../src/services/auth-service', () => ({
  authService: {
    forgotPassword: jest.fn(async () => ({ message: 'If the email exists, an OTP has been sent' })),
    resetPassword: jest.fn(async () => ({})),
    me: jest.fn(),
  },
}));

const { act } = ReactTestRenderer;

function textOf(tree: ReactTestRenderer.ReactTestRenderer) {
  return JSON.stringify(tree.toJSON());
}

function pressableAround(node: ReactTestInstance | null) {
  while (node && !node.props.onPress) node = node.parent;
  return node;
}

// The pressable around the given text (a screen title with the same words is skipped).
async function press(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  const target = tree.root
    .findAll(n => n.props.children === label)
    .map(pressableAround)
    .find(Boolean);
  if (!target) throw new Error(`Nothing pressable labelled "${label}"`);
  await act(async () => target.props.onPress());
}

async function type(tree: ReactTestRenderer.ReactTestRenderer, placeholder: string, text: string) {
  const input = tree.root.findAll(n => n.props.placeholder === placeholder && n.props.onChangeText)[0];
  await act(async () => input.props.onChangeText(text));
}

test('a seller resets their password and lands back on Sign In', async () => {
  await AsyncStorage.setItem('app.onboarded', '1');
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  // Real timers throughout: the splash plays for 1.6s.
  await act(() => new Promise<void>(resolve => setTimeout(resolve, 2000)));

  await type(tree, 'Enter your email address', 'owner@shop.com');
  await press(tree, 'Forgot Password?');
  expect(textOf(tree)).toContain('Forgot Password');

  await press(tree, 'Send Code');
  expect(authService.forgotPassword).toHaveBeenCalledWith('owner@shop.com');
  expect(textOf(tree)).toContain('Reset Password');

  // A weak password is refused before anything is sent.
  const code = tree.root.findAll(n => n.props.textContentType === 'oneTimeCode')[0];
  await act(async () => code.props.onChangeText('112211'));
  await type(tree, 'Choose a new password', 'weak');
  await type(tree, 'Type the new password again', 'weak');
  await press(tree, 'Reset Password');
  expect(authService.resetPassword).not.toHaveBeenCalled();
  expect(textOf(tree)).toContain('meets every rule');

  await type(tree, 'Choose a new password', 'NewPass@123');
  await type(tree, 'Type the new password again', 'NewPass@123');
  await press(tree, 'Reset Password');
  expect(authService.resetPassword).toHaveBeenCalledWith('owner@shop.com', '112211', 'NewPass@123');
  expect(textOf(tree)).toContain('Seller Sign In');
  expect(textOf(tree)).toContain('Your password has been reset');

  await act(async () => tree.unmount());
});
