import ReactTestRenderer, { type ReactTestInstance } from 'react-test-renderer';

const { act } = ReactTestRenderer;

type Rendered = ReturnType<ReactTestRenderer.ReactTestRenderer['toJSON']>;

/** Every visible text string, as a JSON array (so `'"24"'` matches a whole string). */
export function textOf(tree: ReactTestRenderer.ReactTestRenderer) {
  const texts: string[] = [];
  const walk = (node: Rendered | string) => {
    if (!node) return;
    if (typeof node === 'string') texts.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else node.children?.forEach(walk);
  };
  walk(tree.toJSON());
  return JSON.stringify(texts);
}

function pressableAround(node: ReactTestInstance | null) {
  while (node && !node.props.onPress) node = node.parent;
  return node;
}

/** Presses the pressable around the given text or accessibility label (a same-worded title is skipped). */
export async function press(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  const target = tree.root
    .findAll(n => n.props.children === label || n.props.accessibilityLabel === label)
    .map(pressableAround)
    .find(Boolean);
  if (!target) throw new Error(`Nothing pressable labelled "${label}"`);
  await act(async () => target.props.onPress());
}

export async function type(tree: ReactTestRenderer.ReactTestRenderer, placeholder: string, text: string) {
  const input = tree.root.findAll(n => n.props.placeholder === placeholder && n.props.onChangeText)[0];
  await act(async () => input.props.onChangeText(text));
}

/** Waits out the 1.6s splash with real timers. */
export async function pastSplash() {
  await act(() => new Promise<void>(resolve => setTimeout(resolve, 2000)));
}
