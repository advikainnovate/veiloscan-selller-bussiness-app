import { formatNumber, formatRupees, trend } from '../src/lib/format';

test('Indian digit grouping', () => {
  expect(formatNumber(0)).toBe('0');
  expect(formatNumber(999)).toBe('999');
  expect(formatNumber(1286)).toBe('1,286');
  expect(formatNumber(128450)).toBe('1,28,450');
  expect(formatNumber(12345678)).toBe('1,23,45,678');
  expect(formatRupees(28450.5)).toBe('₹28,450.50');
});

test('change against yesterday', () => {
  expect(trend(24, 20)).toEqual({ direction: 'up', label: '+20%' });
  expect(trend(15, 20)).toEqual({ direction: 'down', label: '−25%' });
  expect(trend(103, 100)).toEqual({ direction: 'up', label: '+3%' });
  expect(trend(5, 0)).toEqual({ direction: 'up', label: 'Up from 0' });
  expect(trend(7, 7)).toEqual({ direction: 'flat', label: 'Same as' });
});

test('stock quantities keep up to three decimals', () => {
  const { formatQuantity, readableQty } = require('../src/lib/inventory');
  expect(formatQuantity(0.125)).toBe('0.125');
  expect(formatQuantity(25000.5)).toBe('25,000.5');
  expect(formatQuantity(1250000)).toBe('12,50,000');
  const uoms = [
    { code: 'GM', stockType: 'WEIGHT', factorToBase: '1' },
    { code: 'KG', stockType: 'WEIGHT', factorToBase: '1000' },
    { code: 'MG', stockType: 'WEIGHT', factorToBase: '0.001' },
  ];
  expect(readableQty(25000, 'GM', uoms)).toBe('25 KG');
  expect(readableQty(750, 'GM', uoms)).toBe('750 GM');
  expect(readableQty(12, 'PCS', uoms)).toBe('12 PCS');
});
