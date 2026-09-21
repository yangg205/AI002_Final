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
import type { ExerciseRecommendationId } from './src/services/moodCheckins';
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
  const handoffId = useRef(0);
  const [activeTab, setActiveTab] = useState<AppTab>(DEFAULT_TAB);
  const [authComplete, setAuthComplete] = useState(false);
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [, setApiBaseUrlState] = useState(getApiBaseUrl);
  const [settingsReady, setSettingsReady] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [exerciseRequest, setExerciseRequest] = useState<{ id: number; exerciseId: ExerciseRecommendationId } | null>(null);
  const [stressHandoff, setStressHandoff] = useState<{ id: number; text: string } | null>(null);

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
  const handleOpenSuggestedExercise = useCallback((exerciseId: ExerciseRecommendationId) => {
    handoffId.current += 1;
    setExerciseRequest({ id: handoffId.current, exerciseId });
    setActiveTab('exercises');
  }, []);
  const handleShareStressWithJoy = useCallback((text: string) => {
    handoffId.current += 1;
    setStressHandoff({ id: handoffId.current, text });
    setActiveTab('chat');
    showToast('Đã đưa lần đo vào tin nhắn. Bạn xem lại rồi gửi cho Joy nhé.');
  }, [showToast]);

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

      <View style={[styles.scenes, showAccountInfo && styles.hiddenScene]}>
        <TabScene active={activeTab === 'chat'} tab="chat">
          <ChatScreen
            active={activeTab === 'chat' && settingsReady}
            onNotify={showToast}
            onNavigate={setActiveTab}
            username={authUser?.username}
            accountKey={authUser ? String(authUser.id) : 'guest'}
            accessToken={accessToken ?? undefined}
            consentAt={authUser?.consent_at ?? null}
            stressHandoff={stressHandoff}
            onConsentChange={setAuthUser}
            historyRevision={historyRevision}
            onServerUrlChange={handleServerUrlChange}
            onServerUrlSave={handleServerUrlSave}
          />
        </TabScene>

        <TabScene active={activeTab === 'stress'} tab="stress">
          <StressCheckScreen
            accountKey={authUser ? String(authUser.id) : 'guest'}
            onNotify={showToast}
            onOpenExercise={handleOpenSuggestedExercise}
            onShareWithJoy={handleShareStressWithJoy}
          />
        </TabScene>

        <TabScene active={activeTab === 'exercises'} tab="exercises">
          <ExercisesScreen active={activeTab === 'exercises'} onNotify={showToast} recommendationRequest={exerciseRequest} />
        </TabScene>

        <TabScene active={activeTab === 'alerts'} tab="alerts">
          <AlertScreen
            onNavigate={setActiveTab}
            onNotify={showToast}
            accountKey={authUser ? String(authUser.id) : 'guest'}
            accessToken={accessToken ?? undefined}
            active={activeTab === 'alerts' && settingsReady}
          />
        </TabScene>
      </View>

      {showAccountInfo && <AccountInfoScreen
          user={authUser}
          accessToken={accessToken ?? undefined}
          onUserChange={updated => {
            const reenabled = !authUser?.consent_at && !!updated.consent_at;
            setAuthUser(updated);
            if (reenabled) setHistoryRevision(value => value + 1);
          }}
          onHistoryDeleted={() => setHistoryRevision(value => value + 1)}
          onBack={() => setShowAccountInfo(false)}
          onLogout={() => {
            setShowAccountInfo(false);
            setAuthComplete(false);
            setAuthUser(null);
            setAccessToken(null);
            setStressHandoff(null);
            setExerciseRequest(null);
            setSettingsReady(false);
          }}
        />}

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
