import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../../theme';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../lib/api';
import { GSTIN } from '../../lib/operations';
import { expensesService, type Supplier, type SupplierLedger } from '../../services/expenses-service';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Field, Input } from '../form/Fields';

/** Add or edit a supplier's details (the panel's SupplierFormModal). */
export function SupplierFormSheet({
  storeId,
  visible,
  supplier,
  onClose,
  onSaved,
}: {
  storeId: string;
  visible: boolean;
  supplier: Supplier | SupplierLedger | null;
  onClose: () => void;
  onSaved: (s: SupplierLedger) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', gstNumber: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!visible) return;
    setForm({
      name: supplier?.name ?? '',
      phone: supplier?.phone ?? '',
      email: supplier?.email ?? '',
      address: supplier?.address ?? '',
      gstNumber: supplier?.gstNumber ?? '',
      notes: supplier?.notes ?? '',
    });
    setError('');
  }, [visible, supplier]);

  async function save() {
    if (!form.name.trim()) return setError("Enter the supplier's name");
    const gst = form.gstNumber.trim().toUpperCase();
    if (gst && !GSTIN.test(gst)) return setError('The GST number has 15 letters and digits');
    setError('');
    setSaving(true);
    const payload = { ...form, name: form.name.trim(), gstNumber: gst };
    try {
      const saved = supplier
        ? await expensesService.updateSupplier(storeId, supplier.id, payload)
        : await expensesService.createSupplier(storeId, {
            ...payload,
            gstNumber: gst || undefined,
            phone: form.phone.trim() || undefined,
            email: form.email.trim() || undefined,
          });
      toast(supplier ? 'Supplier updated' : 'Supplier added');
      onSaved(saved);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} title={supplier ? 'Edit Supplier' : 'Add Supplier'} onClose={onClose} footer={<Button title="Save" onPress={save} loading={saving} />}>
      <Field label="Supplier Name" required>
        <Input value={form.name} onChangeText={v => set('name', v)} maxLength={150} />
      </Field>
      <Field label="Mobile Number">
        <Input value={form.phone} onChangeText={v => set('phone', v)} maxLength={20} keyboardType="phone-pad" />
      </Field>
      <Field label="Email">
        <Input value={form.email} onChangeText={v => set('email', v)} maxLength={150} keyboardType="email-address" autoCapitalize="none" />
      </Field>
      <Field label="GST Number" hint="15 letters and digits">
        <Input value={form.gstNumber} onChangeText={v => set('gstNumber', v.toUpperCase())} maxLength={15} autoCapitalize="characters" />
      </Field>
      <Field label="Address">
        <Input value={form.address} onChangeText={v => set('address', v)} maxLength={500} multiline />
      </Field>
      <Field label="Notes">
        <Input value={form.notes} onChangeText={v => set('notes', v)} maxLength={2000} multiline />
      </Field>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.error },
});
