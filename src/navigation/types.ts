import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/** The five quick pages in the bottom bar. */
export type TabParamList = {
  Home: undefined;
  Orders: undefined;
  Products: undefined;
  Customers: undefined;
  Reports: undefined;
};

export type RootStackParamList = {
  GetStarted: undefined;
  /** `email` pre-fills the form; `notice` is a success message, e.g. after a password reset. */
  Login: { email?: string; notice?: string } | undefined;
  ForgotPassword: { email?: string } | undefined;
  ResetPassword: { email: string };
  /** The signed-in app: the bottom tabs. */
  Main: NavigatorScreenParams<TabParamList> | undefined;
  /** Any other page from the menu or header, by its menu key. */
  Module: { key: string };
  OrderDetail: { id: string };
  /** A self order (counter / phone); with `requestId`, an order request's final bill. */
  CreateOrder: { requestId?: string } | undefined;
  OrderRequests: undefined;
  ProductDetail: { id: string };
  /** Create (no id) or edit a product. */
  ProductEditor: { id?: string };
  OrderRequestDetail: { id: string };
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
