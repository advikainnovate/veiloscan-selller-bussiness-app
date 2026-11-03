import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance, type ScrollViewProps, type StyleProp, type ViewInstance, type ViewStyle } from 'react-native';

// The app draws edge to edge (Android 15+ always does), so Android no longer
// shrinks the window for the keyboard and `adjustResize` does nothing. These
// keep the focused field above the keyboard on both platforms.

/** The keyboard's height while it's open, else 0. */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', e => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

// Fields call this when focused, so moving to the next field ("Next" on the
// keyboard) brings it into view too. Outside a KeyboardScroll it does nothing.
const RevealContext = createContext<() => void>(() => {});
export const useRevealFocused = () => useContext(RevealContext);

// Room kept between the focused field and the top of the keyboard.
const GAP = 28;

/**
 * A ScrollView that leaves room for the keyboard and scrolls the focused
 * field just above it. `innerStyle` lays out the children (e.g. centring
 * them), since they sit in a measured wrapper.
 */
export function KeyboardScroll({ children, contentContainerStyle, innerStyle, ...props }: ScrollViewProps & { children: ReactNode; innerStyle?: StyleProp<ViewStyle> }) {
  const scroll = useRef<ScrollViewInstance>(null);
  const content = useRef<ViewInstance>(null);
  const viewport = useRef(0);
  const offset = useRef(0);
  const keyboard = useKeyboardHeight();
  const keyboardRef = useRef(0);
  keyboardRef.current = keyboard;

  const reveal = useCallback(() => {
    // After layout has caught up with the keyboard's padding.
    setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput() as unknown as {
        measureLayout?: (relativeTo: unknown, onSuccess: (x: number, y: number, w: number, h: number) => void, onFail?: () => void) => void;
      } | null;
      if (!input?.measureLayout || !content.current || !keyboardRef.current) return;
      input.measureLayout(
        content.current,
        (_x, y, _w, h) => {
          const visible = viewport.current - keyboardRef.current;
          const below = y + h + GAP - visible;
          // Scroll only as far as needed; never hide the field's label above.
          if (below > offset.current) scroll.current?.scrollTo({ y: below, animated: true });
          else if (y - GAP < offset.current) scroll.current?.scrollTo({ y: Math.max(0, y - GAP * 2), animated: true });
        },
        () => {},
      );
    }, 60);
  }, []);

  useEffect(() => {
    if (keyboard) reveal();
  }, [keyboard, reveal]);

  return (
    <RevealContext.Provider value={reveal}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={32}
        {...props}
        onLayout={e => {
          viewport.current = e.nativeEvent.layout.height;
          props.onLayout?.(e);
        }}
        onScroll={e => {
          offset.current = e.nativeEvent.contentOffset.y;
          props.onScroll?.(e);
        }}
        contentContainerStyle={[contentContainerStyle, keyboard ? { paddingBottom: keyboard + GAP } : null]}
      >
        <View ref={content} collapsable={false} style={[styles.inner, innerStyle]}>
          {children}
        </View>
      </ScrollView>
    </RevealContext.Provider>
  );
}

const styles = StyleSheet.create({ inner: { flexGrow: 1 } });
