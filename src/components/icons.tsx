import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

// The Seller Panel's line icons (src/components/icons.tsx), drawn with
// react-native-svg: a 24×24 grid, 1.7 stroke, round caps.
export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

type Shape =
  | { d: string }
  | { rect: { x: number; y: number; width: number; height: number; rx: number } }
  | { circle: { cx: number; cy: number; r: number } };

function makeIcon(shapes: Shape[], defaultStroke = 1.7) {
  return function Icon({ size = 20, color = '#061b3a', strokeWidth = defaultStroke }: IconProps) {
    const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {shapes.map((shape, i) =>
          'd' in shape ? (
            <Path key={i} d={shape.d} {...stroke} />
          ) : 'rect' in shape ? (
            <Rect key={i} {...shape.rect} {...stroke} />
          ) : (
            <Circle key={i} {...shape.circle} {...stroke} />
          ),
        )}
      </Svg>
    );
  };
}

export const MailIcon = makeIcon([
  { rect: { x: 3.5, y: 5.5, width: 17, height: 13, rx: 2 } },
  { d: 'M4.5 7 12 13l7.5-6' },
]);

export const LockIcon = makeIcon([
  { rect: { x: 4.5, y: 10.5, width: 15, height: 9.5, rx: 2.2 } },
  { d: 'M7.5 10.5V7.75a4.5 4.5 0 0 1 9 0V10.5' },
  { d: 'M12 14.25v2.5' },
]);

export const MobileIcon = makeIcon([
  { rect: { x: 7, y: 2.5, width: 10, height: 19, rx: 2.2 } },
  { d: 'M12 18.2h.01' },
]);

export const ArrowRightIcon = makeIcon([{ d: 'M4.5 12h15M13.5 6l6 6-6 6' }], 1.8);

export const ArrowLeftIcon = makeIcon([{ d: 'M19.5 12h-15M10.5 6l-6 6 6 6' }], 1.8);

export const EyeIcon = makeIcon([
  { d: 'M2.5 12S5.8 5.5 12 5.5 21.5 12 21.5 12 18.2 18.5 12 18.5 2.5 12 2.5 12Z' },
  { circle: { cx: 12, cy: 12, r: 2.75 } },
]);

export const EyeOffIcon = makeIcon([
  { d: 'M3.5 3.5l17 17' },
  {
    d: 'M10.6 5.68A10.6 10.6 0 0 1 12 5.5c6.2 0 9.5 6.5 9.5 6.5a15.4 15.4 0 0 1-3.3 4.13M7.5 6.98C4.86 8.4 2.5 12 2.5 12s3.3 6.5 9.5 6.5c1.2 0 2.28-.24 3.24-.65',
  },
  { d: 'M9.9 10.4a2.75 2.75 0 0 0 3.7 3.7' },
]);

export const StoreIcon = makeIcon([
  { d: 'M4 9.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5' },
  { d: 'M3 9.5l1.4-5A1 1 0 0 1 5.36 3.7h13.28a1 1 0 0 1 .96.8l1.4 5' },
  { d: 'M3 9.5a2.6 2.6 0 0 0 5 1 2.6 2.6 0 0 0 5 0 2.6 2.6 0 0 0 5 0 2.6 2.6 0 0 0 5-1' },
  { d: 'M9.5 20v-4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V20' },
]);

export const BoxIcon = makeIcon([
  { d: 'M3.5 8.2 12 3.5l8.5 4.7V15.8L12 20.5l-8.5-4.7V8.2Z' },
  { d: 'M3.7 8.1 12 12.6l8.3-4.5M12 12.6V20.4' },
]);

export const LayersIcon = makeIcon([
  { d: 'M12 3.5 20.5 8 12 12.5 3.5 8Z' },
  { d: 'm3.5 12 8.5 4.5 8.5-4.5' },
  { d: 'm3.5 16 8.5 4.5 8.5-4.5' },
]);

export const ChartTrendIcon = makeIcon([
  { rect: { x: 3, y: 3.5, width: 18, height: 17, rx: 2 } },
  { d: 'M6.5 16l4-4.5 3 2.5 4-5' },
  { d: 'M14.5 9h3v3' },
]);

export const ShieldCheckIcon = makeIcon([
  { d: 'M12 3.5 19 6v5.2c0 4.6-3 7.6-7 9.3-4-1.7-7-4.7-7-9.3V6l7-2.5Z' },
  { d: 'M9.25 12.1l1.9 1.9 3.6-3.9' },
]);

export const CheckIcon = makeIcon([{ d: 'M5 12.5l4.5 4.5L19 7.5' }], 2.2);

export const CheckCircleIcon = makeIcon([
  { circle: { cx: 12, cy: 12, r: 8.5 } },
  { d: 'm8.5 12.3 2.4 2.4 4.6-5.1' },
]);

export const ClockIcon = makeIcon([
  { circle: { cx: 12, cy: 12, r: 8.5 } },
  { d: 'M12 7.5V12l3 2' },
]);

export const AlertCircleIcon = makeIcon([
  { circle: { cx: 12, cy: 12, r: 8.5 } },
  { d: 'M12 8v4.5' },
  { d: 'M12 16h.01' },
]);

export const HelpCircleIcon = makeIcon([
  { circle: { cx: 12, cy: 12, r: 8.5 } },
  { d: 'M9.3 9.3a2.7 2.7 0 1 1 3.9 2.4c-.9.5-1.2 1-1.2 2' },
  { d: 'M12 16.5h.01' },
]);

export const LogoutIcon = makeIcon([
  { d: 'M13 4.5H7.5A1.5 1.5 0 0 0 6 6v12a1.5 1.5 0 0 0 1.5 1.5H13' },
  { d: 'M16.5 15.5 21 11l-4.5-4.5' },
  { d: 'M21 11H9.5' },
]);

// Menu, header and tab icons (from the Seller Panel).
export const HomeIcon = makeIcon([
  { d: 'M3 10.5 12 3l9 7.5' },
  { d: 'M5.5 9.5V21h13V9.5' },
  { d: 'M9.5 21v-6h5v6' },
]);

export const ShoppingBagIcon = makeIcon([
  { d: 'M6 8h12l-1 12.5H7Z' },
  { d: 'M9 8V6a3 3 0 0 1 6 0v2' },
]);

export const ClipboardListIcon = makeIcon([
  { rect: { x: 5, y: 4, width: 14, height: 17, rx: 2 } },
  { d: 'M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z' },
  { d: 'M8.5 11h7M8.5 14.5h7M8.5 18h4.5' },
]);

export const UsersIcon = makeIcon([
  { circle: { cx: 9, cy: 8, r: 3.25 } },
  { d: 'M2.75 20c0-3.45 2.8-6 6.25-6s6.25 2.55 6.25 6' },
  { d: 'M15.5 5.5a3 3 0 0 1 0 5.9' },
  { d: 'M17.75 14.25c2.6.5 4.5 2.55 4.5 5.75' },
]);

export const UserPlusIcon = makeIcon([
  { circle: { cx: 10, cy: 8, r: 3.5 } },
  { d: 'M3.5 20c0-3.6 2.9-6.25 6.5-6.25 1.6 0 3 .5 4.1 1.35' },
  { d: 'M18.5 13.5v6M15.5 16.5h6' },
]);

export const RupeeIcon = makeIcon([{ d: 'M7 4.5h10M7 9h10M7 4.5h3.5a4.5 4.5 0 0 1 0 9H7l7.5 6.5' }]);

export const WalletIcon = makeIcon([
  { d: 'M3.5 7.5A2 2 0 0 1 5.5 5.5h12A2 2 0 0 1 19.5 7.5v9a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2Z' },
  { d: 'M14.5 12.75a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z' },
  { d: 'M19.5 10h-4a1.5 1.5 0 0 0 0 3h4' },
]);

export const BarChartIcon = makeIcon([
  { rect: { x: 3.5, y: 13, width: 4, height: 7, rx: 1 } },
  { rect: { x: 10, y: 9, width: 4, height: 11, rx: 1 } },
  { rect: { x: 16.5, y: 4, width: 4, height: 16, rx: 1 } },
]);

export const TicketIcon = makeIcon([
  { d: 'M3.5 9.5a2 2 0 0 0 0 5v1.5A1.5 1.5 0 0 0 5 17.5h14a1.5 1.5 0 0 0 1.5-1.5V14a2 2 0 0 1 0-4V8.5A1.5 1.5 0 0 0 19 7H5a1.5 1.5 0 0 0-1.5 1.5Z' },
  { d: 'M9.5 7v10.5' },
]);

export const GiftIcon = makeIcon([
  { rect: { x: 3.5, y: 9, width: 17, height: 4.5, rx: 0.8 } },
  { d: 'M5 13.5h14V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1Z' },
  { d: 'M12 9v12' },
  { d: 'M12 9C9.5 9 8 7.5 8 6a2 2 0 0 1 4 0 2 2 0 0 1 4 0c0 1.5-1.5 3-4 3Z' },
]);

export const CreditCardIcon = makeIcon([
  { rect: { x: 3, y: 5.5, width: 18, height: 13, rx: 2 } },
  { d: 'M3 9.5h18' },
  { d: 'M6.5 14.5h4' },
]);

export const PercentIcon = makeIcon([
  { d: 'M5 19 19 5' },
  { circle: { cx: 7, cy: 7, r: 2.2 } },
  { circle: { cx: 17, cy: 17, r: 2.2 } },
]);

export const TruckIcon = makeIcon([
  { d: 'M3 6.5h10v9H3z' },
  { d: 'M13 9.5h3.6l3.4 3v3H13z' },
  { circle: { cx: 7, cy: 17, r: 1.8 } },
  { circle: { cx: 17, cy: 17, r: 1.8 } },
]);

export const FolderIcon = makeIcon([
  { d: 'M3.5 6.5a1.5 1.5 0 0 1 1.5-1.5h4.2l1.8 2h7a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5Z' },
]);

export const TagIcon = makeIcon([
  { d: 'M12.6 3H5.4A2.4 2.4 0 0 0 3 5.4v7.2c0 .64.25 1.24.7 1.7l8.1 8.1a2.4 2.4 0 0 0 3.4 0l6.1-6.1a2.4 2.4 0 0 0 0-3.4L13.2 4.7c-.46-.46-1.06-.7-1.7-.7Z' },
  { circle: { cx: 8.25, cy: 8.25, r: 1.4 } },
]);

export const SlidersIcon = makeIcon([
  { d: 'M4 6h9M17 6h3M4 12h3M9 12h11M4 18h13M20 18h0' },
  { circle: { cx: 15, cy: 6, r: 2 } },
  { circle: { cx: 7, cy: 12, r: 2 } },
  { circle: { cx: 17, cy: 18, r: 2 } },
]);

export const StarIcon = makeIcon([
  { d: 'M12 3.5 14.5 9l6 .8-4.4 4.1 1.1 5.9L12 16.9 6.8 19.8l1.1-5.9L3.5 9.8 9.5 9Z' },
]);

export const WarehouseIcon = makeIcon([
  { d: 'M3.5 10 12 4l8.5 6v9.5h-17Z' },
  { d: 'M9 20v-6h6v6' },
]);

export const BuildingIcon = makeIcon([
  { rect: { x: 5, y: 3.5, width: 11, height: 17, rx: 1 } },
  { d: 'M16 9.5h3v11h-14' },
  { d: 'M8 7h1M11 7h1M8 10.5h1M11 10.5h1M8 14h1M11 14h1' },
]);

export const CalendarIcon = makeIcon([
  { rect: { x: 3.5, y: 5, width: 17, height: 15, rx: 2 } },
  { d: 'M3.5 9.5h17' },
  { d: 'M8 3v4M16 3v4' },
]);

export const FileTextIcon = makeIcon([
  { d: 'M7 3.5h7l3.5 3.5v13.5H7Z' },
  { d: 'M14 3.5V7h3.5' },
  { d: 'M9.5 12h5M9.5 15.5h5M9.5 18.5h3' },
]);

export const SettingsIcon = makeIcon([
  { circle: { cx: 12, cy: 12, r: 3 } },
  { d: 'M19.4 12.9v-1.8l2-1.15-1.75-3.03-2.15.7a7.6 7.6 0 0 0-1.55-.9l-.35-2.22h-3.2l-.35 2.22a7.6 7.6 0 0 0-1.55.9l-2.15-.7L6.6 9.95l2 1.15v1.8l-2 1.15 1.75 3.03 2.15-.7c.47.38.99.68 1.55.9l.35 2.22h3.2l.35-2.22c.56-.22 1.08-.52 1.55-.9l2.15.7 1.75-3.03Z' },
]);

export const QrCodeIcon = makeIcon([
  { rect: { x: 4, y: 4, width: 6, height: 6, rx: 1 } },
  { rect: { x: 14, y: 4, width: 6, height: 6, rx: 1 } },
  { rect: { x: 4, y: 14, width: 6, height: 6, rx: 1 } },
  { d: 'M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 19v1M20 14v1' },
]);

export const AwardIcon = makeIcon([
  { circle: { cx: 12, cy: 8.5, r: 5 } },
  { d: 'M8.5 12.8 7 21l5-2.5 5 2.5-1.5-8.2' },
]);

export const MenuIcon = makeIcon([
  { d: 'M4 6.5h16' },
  { d: 'M4 12h16' },
  { d: 'M4 17.5h16' },
]);

export const BellIcon = makeIcon([
  { d: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' },
  { d: 'M13.73 21a2 2 0 0 1-3.46 0' },
]);

export const ChevronRightIcon = makeIcon([
  { d: 'M9.5 5 16 12l-6.5 7' },
]);

export const ChevronDownIcon = makeIcon([
  { d: 'M5.5 8.5 12 15l6.5-6.5' },
]);

export const CloseIcon = makeIcon([
  { d: 'M6 6l12 12' },
  { d: 'M18 6 6 18' },
]);

export const UserIcon = makeIcon([
  { d: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z' },
  { d: 'M4.5 20c1.2-3.5 4.2-5.5 7.5-5.5s6.3 2 7.5 5.5' },
]);

export const SearchIcon = makeIcon([
  { circle: { cx: 10.5, cy: 10.5, r: 6.5 } },
  { d: 'm20 20-4.8-4.8' },
]);


export const CartIcon = makeIcon([
  { d: 'M2.5 3.5h2.2l2.1 11.1a1.5 1.5 0 0 0 1.5 1.2h8.9a1.5 1.5 0 0 0 1.5-1.1l1.8-7.2H5.6' },
  { circle: { cx: 9, cy: 20, r: 1.3 } },
  { circle: { cx: 17, cy: 20, r: 1.3 } },
]);

export const ArrowUpIcon = makeIcon([{ d: 'M12 19V5M6 11l6-6 6 6' }], 2.2);

export const ArrowDownIcon = makeIcon([{ d: 'M12 5v14M6 13l6 6 6-6' }], 2.2);

// Lists, orders and forms.
export const PlusIcon = makeIcon([
  { d: 'M12 5v14M5 12h14' },
]);

export const BanIcon = makeIcon([
  { circle: { cx: 12, cy: 12, r: 8.5 } },
  { d: 'm6.3 6.3 11.4 11.4' },
]);

export const TrashIcon = makeIcon([
  { d: 'M4 7h16M10 11v6M14 11v6' },
  { d: 'M5.5 7l1 12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2l1-12M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7' },
]);

export const RefreshIcon = makeIcon([
  { d: 'M20 11a8 8 0 0 0-14.5-4.5M4 4v5h5' },
  { d: 'M4 13a8 8 0 0 0 14.5 4.5M20 20v-5h-5' },
]);

export const EditIcon = makeIcon([
  { d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' },
  { d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' },
]);

export const FilterIcon = makeIcon([
  { d: 'M4 5h16l-6 7.5V19l-4 2v-8.5Z' },
]);

export const MapPinIcon = makeIcon([
  { d: 'M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Z' },
  { circle: { cx: 12, cy: 9.5, r: 2.2 } },
]);

export const PhoneIcon = makeIcon([
  { d: 'M6.5 3.5h2.7l1.3 4-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4 1.3v2.7c0 1.1-.9 2-2 2-8.3-.5-15-7.2-15.5-15.5 0-1.1.9-2 2-2Z' },
]);


export const ImageIcon = makeIcon([
  { rect: { x: 3.5, y: 4.5, width: 17, height: 15, rx: 2 } },
  { circle: { cx: 9, cy: 10, r: 1.6 } },
  { d: 'm5 18 5.5-5.5L14 16l2-2 3 3' },
]);
