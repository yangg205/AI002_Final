import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  AppBottomNavigation,
  BOTTOM_NAV_HEIGHT,
} from './src/components/AppBottomNavigation';
import { AppHeader } from './src/components/AppHeader';
import { AuthScreen } from './src/screens/AuthScreen';
import { AccountInfoScreen } from './src/screens/AccountInfoScreen';
import {
  ToastBanner,
  type ToastMessage,
} from './src/components/ToastBanner';
import type { AppTab } from './src/navigation/tabs';
import { AlertScreen } from './src/screens/AlertScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { ExercisesScreen } from './src/screens/ExercisesScreen';
import { StressCheckScreen } from './src/screens/StressCheckScreen';
import { colors } from './src/theme/colors';
import type { AuthUser } from './src/services/api';
import { activateAccountSettings, saveAccountSettings } from './src/services/accountSettings';
import { getApiBaseUrl } from './src/services/api';

const DEFAULT_TAB: AppTab = 'stress';

type TabSceneProps = {
  readonly active: boolean;
  readonly children: ReactNode;
  readonly tab: AppTab;
};

function TabScene({ active, children, tab }: TabSceneProps) {
  return (
    <View
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      style={[styles.scene, !active && styles.hiddenScene]}
      testID={`scene-${tab}`}
    >
      {children}
    </View>
  );
}

function AppShell() {
  const insets = useSafeAreaInsets();
  const toastId = useRef(0);
  const [activeTab, setActiveTab] = useState<AppTab>(DEFAULT_TAB);
  const [authComplete, setAuthComplete] = useState(false);
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [, setAccessToken] = useState<string | null>(null);
  const [, setApiBaseUrlState] = useState(getApiBaseUrl);
  const [settingsReady, setSettingsReady] = useState(false);
  const [assessmentRequest, setAssessmentRequest] = useState(0);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((text: string) => {
    toastId.current += 1;
    setToast({ id: toastId.current, text });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);
  const handleServerUrlChange = useCallback((url: string) => {
    setApiBaseUrlState(url);
  }, []);
  const handleServerUrlSave = useCallback((url: string) => {
    if (authUser) void saveAccountSettings(String(authUser.id), { apiBaseUrl: url });
  }, [authUser]);

  if (!authComplete) {
    return (
      <View style={styles.app}>
        <AuthScreen
          onAuthenticated={(user, token) => {
            setAuthUser(user);
            setAccessToken(token);
            void activateAccountSettings(String(user.id)).then(url => {
              setApiBaseUrlState(url);
              setSettingsReady(true);
            });
            setAuthComplete(true);
          }}
          onContinueAsGuest={() => { setSettingsReady(true); setAuthComplete(true); }}
        />
      </View>
    );
  }

  return (
    <View style={styles.app}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <AppHeader
          onBellPress={() => setActiveTab('alerts')}
          accountLabel={authUser?.username ?? undefined}
          onAccountPress={() => {
            setShowAccountInfo(true);
          }}
        />
      </SafeAreaView>

      {showAccountInfo ? (
        <AccountInfoScreen
          user={authUser}
          onBack={() => setShowAccountInfo(false)}
          onLogout={() => {
            setShowAccountInfo(false);
            setAuthComplete(false);
            setAuthUser(null);
            setAccessToken(null);
          }}
        />
      ) : <View style={styles.scenes}>
        <TabScene active={activeTab === 'chat'} tab="chat">
          <ChatScreen
            active={activeTab === 'chat' && settingsReady}
            onNotify={showToast}
            onNavigate={setActiveTab}
            onRequestAssessment={() => {
              setAssessmentRequest(value => value + 1);
              setActiveTab('stress');
            }}
            username={authUser?.username}
            accountKey={authUser ? String(authUser.id) : 'guest'}
            onServerUrlChange={handleServerUrlChange}
            onServerUrlSave={handleServerUrlSave}
          />
        </TabScene>

        <TabScene active={activeTab === 'stress'} tab="stress">
          <StressCheckScreen onNotify={showToast} onNavigate={setActiveTab} assessmentRequest={assessmentRequest} />
        </TabScene>

        <TabScene active={activeTab === 'exercises'} tab="exercises">
          <ExercisesScreen active={activeTab === 'exercises'} onNotify={showToast} />
        </TabScene>

        <TabScene active={activeTab === 'alerts'} tab="alerts">
          <AlertScreen
            onNavigate={setActiveTab}
            onNotify={showToast}
          />
        </TabScene>
      </View>}

      {!showAccountInfo && <SafeAreaView edges={['bottom']} style={styles.navigationSafeArea}>
        <AppBottomNavigation activeTab={activeTab} onTabPress={setActiveTab} />
      </SafeAreaView>}

      <ToastBanner
        bottomOffset={BOTTOM_NAV_HEIGHT + insets.bottom + 12}
        onDismiss={dismissToast}
        toast={toast}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppShell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerSafeArea: {
    backgroundColor: colors.navigationBackground,
  },
  scenes: {
    flex: 1,
  },
  scene: {
    flex: 1,
  },
  hiddenScene: {
    display: 'none',
  },
  navigationSafeArea: {
    backgroundColor: colors.navigationBackground,
  },
});
