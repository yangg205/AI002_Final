import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { loginAccount, registerAccount, type AuthUser } from '../services/api';
import { colors } from '../theme/colors';

type AuthScreenProps = {
  readonly onAuthenticated: (user: AuthUser, token: string) => void;
  readonly onContinueAsGuest: () => void;
};

type Mode = 'login' | 'register';

function utf8ByteLength(value: string): number {
  return encodeURIComponent(value).replace(/%[\dA-F]{2}|./gi, 'x').length;
}

export function AuthScreen({ onAuthenticated, onContinueAsGuest }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  const submit = async () => {
    const cleanUsername = username.trim();
    if (!cleanUsername) return setError('Bạn chưa nhập tên đăng nhập.');
    if (!/^[A-Za-z0-9._-]{3,32}$/.test(cleanUsername)) {
      return setError('Tên đăng nhập chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang, dài 3 đến 32 ký tự.');
    }
    if (mode === 'register' && password.length < 8) {
      return setError('Mật khẩu cần ít nhất 8 ký tự.');
    }
    if (utf8ByteLength(password) > 72) {
      return setError('Mật khẩu không được vượt quá 72 byte.');
    }
    if (!password) return setError('Bạn chưa nhập mật khẩu.');
    if (mode === 'register' && password !== confirmPassword) {
      return setError('Hai lần nhập mật khẩu chưa khớp nhau.');
    }

    setBusy(true);
    setError('');
    try {
      const result = mode === 'register'
        ? await registerAccount(cleanUsername, password)
        : await loginAccount(cleanUsername, password);
      onAuthenticated(result.user, result.access_token);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Chưa thể xác thực. Bạn thử lại nhé.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.brandMark}><Ionicons color={colors.olive} name="leaf-outline" size={34} /></View>
          <Text accessibilityRole="header" style={styles.brand}>JoyfulMind</Text>
          <Text style={styles.tagline}>Một góc nhỏ để lắng nghe chính mình</Text>

          <View style={styles.card}>
            <View style={styles.headingRow}>
              <View style={styles.headingIcon}>
                <Ionicons color={colors.oliveDark} name="heart" size={21} />
              </View>
              <View style={styles.headingCopy}>
                <Text accessibilityRole="header" style={styles.title}>
                  {mode === 'login' ? 'Chào mừng bạn trở lại' : 'Tạo tài khoản mới'}
                </Text>
                <Text style={styles.subtitle}>
                  {mode === 'login' ? 'Đăng nhập để tiếp tục hành trình chăm sóc bản thân.' : 'Tạo tài khoản để bắt đầu hành trình cùng Joy.'}
                </Text>
              </View>
            </View>

            <View style={styles.modeSwitch}>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === 'login' }}
                onPress={() => switchMode('login')}
                style={[styles.modeButton, mode === 'login' && styles.modeButtonActive]}
                testID="auth-login-tab"
              >
                <Text style={[styles.modeText, mode === 'login' && styles.modeTextActive]}>Đăng nhập</Text>
              </Pressable>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === 'register' }}
                onPress={() => switchMode('register')}
                style={[styles.modeButton, mode === 'register' && styles.modeButtonActive]}
                testID="auth-register-tab"
              >
                <Text style={[styles.modeText, mode === 'register' && styles.modeTextActive]}>Đăng ký</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Tên đăng nhập</Text>
            <View style={styles.inputWrap}>
              <Ionicons color={colors.olive} name="person-outline" size={20} />
              <TextInput
                accessibilityLabel="Tên đăng nhập"
                autoCapitalize="none"
                autoComplete="username"
                autoCorrect={false}
                maxLength={32}
                onChangeText={setUsername}
                onSubmitEditing={submit}
                placeholder="Ví dụ: minhnguyen"
                placeholderTextColor="#82796F"
                returnKeyType="next"
                style={styles.input}
                testID="auth-username"
                value={username}
              />
            </View>

            <Text style={styles.label}>Mật khẩu</Text>
            <View style={styles.inputWrap}>
              <Ionicons color={colors.olive} name="lock-closed-outline" size={20} />
              <TextInput
                accessibilityLabel="Mật khẩu"
                autoCapitalize="none"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                onChangeText={setPassword}
                onSubmitEditing={mode === 'login' ? submit : undefined}
                placeholder="Nhập mật khẩu"
                placeholderTextColor="#82796F"
                returnKeyType={mode === 'login' ? 'go' : 'next'}
                secureTextEntry={!showPassword}
                style={styles.input}
                testID="auth-password"
                value={password}
              />
              <Pressable
                accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setShowPassword(value => !value)}
              >
                <Ionicons color={colors.darkText} name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} />
              </Pressable>
            </View>

            {mode === 'register' && <>
              <Text style={styles.label}>Nhập lại mật khẩu</Text>
              <View style={styles.inputWrap}>
                <Ionicons color={colors.olive} name="shield-checkmark-outline" size={20} />
                <TextInput
                  accessibilityLabel="Nhập lại mật khẩu"
                  autoCapitalize="none"
                  autoComplete="new-password"
                  onChangeText={setConfirmPassword}
                  onSubmitEditing={submit}
                  placeholder="Nhập lại mật khẩu"
                  placeholderTextColor="#82796F"
                  returnKeyType="go"
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  testID="auth-confirm-password"
                  value={confirmPassword}
                />
              </View>
              <Text style={styles.helper}>Tên đăng nhập 3–32 ký tự. Mật khẩu tối thiểu 8 ký tự.</Text>
            </>}

            {!!error && <Text accessibilityRole="alert" style={styles.error} testID="auth-error">{error}</Text>}

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={submit}
              style={({ pressed }) => [styles.submitButton, pressed && !busy && styles.pressed, busy && styles.disabled]}
              testID="auth-submit"
            >
              {busy ? <ActivityIndicator color={colors.white} /> : <>
                <Text style={styles.submitText}>{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</Text>
                <Ionicons color={colors.darkText} name="arrow-forward" size={20} />
              </>}
            </Pressable>

            <View style={styles.dividerRow}><View style={styles.divider} /><Text style={styles.orText}>hoặc</Text><View style={styles.divider} /></View>
            <Pressable accessibilityRole="button" onPress={onContinueAsGuest} style={styles.guestButton} testID="auth-guest">
              <Text style={styles.guestText}>Tiếp tục với tư cách khách</Text>
              <Ionicons color={colors.burgundy} name="arrow-forward" size={18} />
            </Pressable>
          </View>

          <Text style={styles.footer}>Từng bước nhỏ cũng là cách bạn quan tâm đến bản thân.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 30 },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', alignItems: 'center' },
  brandMark: { width: 58, height: 58, borderRadius: 16, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  brand: { marginTop: 12, color: colors.black, fontSize: 25, fontWeight: '700', letterSpacing: -0.3 },
  tagline: { marginTop: 4, marginBottom: 22, color: colors.darkText, fontSize: 15, textAlign: 'center' },
  card: { width: '100%', padding: 22, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.outline },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint },
  headingCopy: { flex: 1, gap: 3 },
  title: { color: colors.black, fontSize: 21, lineHeight: 28, fontWeight: '800' },
  subtitle: { color: colors.darkText, fontSize: 13, lineHeight: 19 },
  modeSwitch: { flexDirection: 'row', marginTop: 22, marginBottom: 20, padding: 4, borderRadius: 10, backgroundColor: colors.creamMuted },
  modeButton: { flex: 1, minHeight: 43, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modeButtonActive: { backgroundColor: colors.highlight },
  modeText: { color: colors.darkText, fontSize: 15, fontWeight: '600' },
  modeTextActive: { color: colors.oliveDark, fontWeight: '800' },
  label: { marginTop: 13, marginBottom: 8, color: colors.darkText, fontSize: 14, fontWeight: '700' },
  inputWrap: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 15, borderRadius: 10, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.background },
  input: { flex: 1, minHeight: 52, color: colors.black, fontSize: 15, outlineStyle: 'none' } as never,
  helper: { marginTop: 9, color: colors.darkText, fontSize: 12, lineHeight: 18 },
  error: { marginTop: 14, padding: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.blush, color: colors.burgundy, fontSize: 13, lineHeight: 19 },
  submitButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 22, paddingHorizontal: 20, borderRadius: 10, backgroundColor: colors.olive },
  submitText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.7 },
  pressed: { opacity: 0.72 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 19 },
  divider: { flex: 1, height: 1, backgroundColor: colors.outline },
  orText: { color: colors.darkText, fontSize: 12 },
  guestButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 7 },
  guestText: { color: colors.burgundy, fontSize: 14, fontWeight: '700' },
  footer: { maxWidth: 300, marginTop: 20, color: colors.darkText, fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
