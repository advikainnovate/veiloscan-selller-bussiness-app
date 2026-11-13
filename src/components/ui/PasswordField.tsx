import React, { useState } from 'react';
import { Pressable } from 'react-native';
import { colors } from '../../theme';
import { EyeIcon, EyeOffIcon, LockIcon } from '../icons';
import { TextField, type TextFieldProps } from './TextField';
import { useTranslation } from 'react-i18next';

/** A password input with a lock icon and a show / hide toggle. */
export function PasswordField({ icon, ...props }: Omit<TextFieldProps, 'trailing'>) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      icon={icon ?? <LockIcon size={18} color={colors.textMuted} />}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      textContentType="password"
      autoComplete="password"
      trailing={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? t('common.hidePassword') : t('common.showPassword')}
          hitSlop={10}
          onPress={() => setVisible(v => !v)}
        >
          {visible ? <EyeOffIcon size={20} color={colors.textMuted} /> : <EyeIcon size={20} color={colors.textMuted} />}
        </Pressable>
      }
      {...props}
    />
  );
}
