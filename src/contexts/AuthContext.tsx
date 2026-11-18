import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  signOut,
  reauthenticateWithPopup,
  EmailAuthProvider,
  reauthenticateWithCredential,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { ensureAdminSeededCatalog } from '../lib/catalogSeed';
import { slugifyHandle } from '../lib/formatters';
import {
  DEFAULT_ADMIN_PERMISSIONS,
  type AdminPermissionKey,
  type AdminPermissions,
  type UserPrivateAccount,
  type UserPublicProfile,
  type UserRole,
} from '../types/bharatplay';

interface AuthContextValue {
  user: User | null;
  profile: UserPublicProfile | null;
  privateAccount: UserPrivateAccount | null;
  authReady: boolean;
  role: UserRole;
  isCeo: boolean;
  isAdmin: boolean;
  isCreator: boolean;
  isSuspended: boolean;
  adminPermissions: AdminPermissions | null;
  hasAdminPermission: (perm: AdminPermissionKey) => boolean;
  signInWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string, asCreator: boolean, preferredLanguage: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  becomeCreator: (bio: string, preferredLanguage: string) => Promise<void>;
  updateUserProfile: (updates: Partial<UserPublicProfile>) => Promise<void>;
  updatePrivateSettings: (
    updates: Pick<Partial<UserPrivateAccount>, 'upiId' | 'notificationsEnabled' | 'themePreference'>
  ) => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  reauthenticateCeo: (password?: string) => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserPublicProfile | null>(null);
  const [privateAccount, setPrivateAccount] = useState<UserPrivateAccount | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [serverCeoCleared, setServerCeoCleared] = useState(false);
  const [serverAdminCleared, setServerAdminCleared] = useState(false);
  const [adminPermissions, setAdminPermissions] = useState<AdminPermissions | null>(null);

  // Strict server-verified RBAC clearance (never trusts client-editable role fields or hardcoded emails)
  const isCeo = Boolean(user && user.emailVerified && serverCeoCleared);
  const isAdmin = isCeo || Boolean(user && user.emailVerified && serverAdminCleared);
  const isSuspended = Boolean(
    profile?.accountStatus === 'suspended' ||
      profile?.accountStatus === 'deleted' ||
      privateAccount?.suspended
  );
  const isCreator =
    !isSuspended &&
    profile?.channelStatus !== 'suspended' &&
    profile?.channelStatus !== 'deleted' &&
    Boolean(profile?.isCreator || privateAccount?.role === 'creator');

  const role: UserRole = isCeo
    ? 'ceo'
    : isAdmin
    ? 'admin'
    : isCreator
    ? 'creator'
    : 'viewer';

  const hasAdminPermission = (perm: AdminPermissionKey): boolean => {
    if (isCeo) return true;
    if (!isAdmin || !adminPermissions) return false;
    return Boolean(adminPermissions[perm]);
  };

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubPrivate: (() => void) | null = null;
    let active = true;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (unsubPrivate) {
        unsubPrivate();
        unsubPrivate = null;
      }

      setUser(firebaseUser);
      setServerCeoCleared(false);
      setServerAdminCleared(false);
      setAdminPermissions(null);

      if (!firebaseUser) {
        setProfile(null);
        setPrivateAccount(null);
        setAuthReady(true);
        return;
      }

      let clearanceCeo = false;
      let clearanceAdmin = false;
      let clearancePerms: AdminPermissions | null = null;

      if (firebaseUser.emailVerified) {
        try {
          const token = await firebaseUser.getIdToken();
          const res = await fetch('/api/auth/clearance', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const clearance = await res.json();
            clearanceCeo = Boolean(clearance.isCeo);
            clearanceAdmin = Boolean(clearance.isAdmin);
            clearancePerms = clearance.adminPermissions || null;
            if (active) {
              setServerCeoCleared(clearanceCeo);
              setServerAdminCleared(clearanceAdmin);
              setAdminPermissions(clearancePerms);
            }
          }
        } catch {
          // Leave clearance false on network error
        }
      }

      const publicRef = doc(db, 'users', firebaseUser.uid);
      const privateRef = doc(db, 'users', firebaseUser.uid, 'private', 'account');

      try {
        const publicSnap = await getDoc(publicRef);

        if (!publicSnap.exists() && firebaseUser.emailVerified) {
          const displayName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'BharatPlay Member';
          const newPublic: UserPublicProfile = {
            uid: firebaseUser.uid,
            displayName: displayName.slice(0, 80),
            handle: slugifyHandle(displayName),
            bio: 'Creator & viewer on BharatPlay.',
            avatarUrl: firebaseUser.photoURL || '/src/assets/images/creator_avatar_lead_1794912702305.jpg',
            bannerUrl: '/src/assets/images/thumb_himalayas_vlog_1794912702886.jpg',
            isCreator: clearanceCeo || clearanceAdmin,
            isEarlyCreator: true,
            isVerified: clearanceCeo,
            isFeatured: false,
            preferredLanguage: 'Hindi',
            subscribersCount: 0,
            totalViews: 0,
            rewardTier: 'Seed',
            accountStatus: 'active',
            channelStatus: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(publicRef, newPublic);
        }

        const privateSnap = await getDoc(privateRef);
        if (!privateSnap.exists() && firebaseUser.emailVerified) {
          await setDoc(privateRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            role: clearanceCeo ? 'ceo' : clearanceAdmin ? 'admin' : 'viewer',
            monetizationEnabled: false,
            estimatedEarningsInr: 0,
            availableBalanceInr: 0,
            pendingBalanceInr: 0,
            lifetimeEarningsInr: 0,
            upiId: '',
            notificationsEnabled: true,
            themePreference:
              (typeof window !== 'undefined' &&
              (window.localStorage.getItem('bharatplay_theme') === 'light' ||
                window.localStorage.getItem('bharatplay_theme') === 'dark')
                ? (window.localStorage.getItem('bharatplay_theme') as 'dark' | 'light')
                : 'dark'),
            suspended: false,
            updatedAt: serverTimestamp(),
          });
        }

        if (clearanceCeo) {
          const ceoRoleRef = doc(db, 'ceoRoles', firebaseUser.uid);
          const ceoSnap = await getDoc(ceoRoleRef).catch(() => null);
          if (!ceoSnap || !ceoSnap.exists()) {
            await setDoc(ceoRoleRef, {
              uid: firebaseUser.uid,
              clearanceLevel: 'CEO',
              grantedAt: serverTimestamp(),
            }).catch(() => {});
          }
          const adminRoleRef = doc(db, 'admins', firebaseUser.uid);
          const adminSnap = await getDoc(adminRoleRef).catch(() => null);
          if (!adminSnap || !adminSnap.exists()) {
            await setDoc(adminRoleRef, {
              uid: firebaseUser.uid,
              displayName: (firebaseUser.displayName || 'CEO').slice(0, 80),
              email: (firebaseUser.email || '').slice(0, 160),
              permissions: {
                ...DEFAULT_ADMIN_PERMISSIONS,
                moderateVideos: true,
                resolveReports: true,
                manageCreators: true,
                manageCompetitions: true,
                manageAnnouncements: true,
                manageCategories: true,
              },
              grantedBy: firebaseUser.uid,
              notes: 'CEO Root Bootstrap',
              grantedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }
        }

        if (clearanceCeo || clearanceAdmin) {
          await ensureAdminSeededCatalog(true);
        }
      } catch (err) {
        console.warn('Profile bootstrap error:', err);
      }

      unsubProfile = onSnapshot(
        publicRef,
        (snap) => {
          if (snap.exists()) {
            setProfile({ id: snap.id, ...(snap.data() as UserPublicProfile) });
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      );

      unsubPrivate = onSnapshot(
        privateRef,
        (snap) => {
          if (snap.exists()) {
            setPrivateAccount(snap.data() as UserPrivateAccount);
          }
          setAuthReady(true);
        },
        () => {
          setAuthReady(true);
        }
      );
    });

    return () => {
      active = false;
      unsubAuth();
      if (unsubProfile) unsubProfile();
      if (unsubPrivate) unsubPrivate();
    };
  }, []);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: any) {
      if (err?.code === 'auth/operation-not-allowed') {
        throw new Error(
          'Email/Password sign-in is not yet enabled in the Firebase Console for this project. Please use Google Sign-In or enable Email/Password under Authentication → Sign-in method.'
        );
      }
      throw err;
    }
  };

  const registerWithEmail = async (
    name: string,
    email: string,
    password: string,
    asCreator: boolean,
    preferredLanguage: string
  ) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, {
        displayName: name.trim(),
        photoURL: '/src/assets/images/creator_avatar_lead_1794912702305.jpg',
      });
      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user);
      }
      if (cred.user.emailVerified) {
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          displayName: name.trim().slice(0, 80),
          handle: slugifyHandle(name),
          bio: asCreator ? 'New Indian creator on BharatPlay Early Creator Program.' : 'BharatPlay viewer.',
          avatarUrl: '/src/assets/images/creator_avatar_lead_1794912702305.jpg',
          bannerUrl: '/src/assets/images/thumb_tech_india_1794912701310.jpg',
          isCreator: asCreator,
          isEarlyCreator: asCreator,
          isVerified: false,
          isFeatured: false,
          preferredLanguage: preferredLanguage || 'Hindi',
          subscribersCount: 0,
          totalViews: 0,
          rewardTier: 'Seed',
          accountStatus: 'active',
          channelStatus: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err: any) {
      if (err?.code === 'auth/operation-not-allowed') {
        throw new Error(
          'Email/Password registration is not yet enabled in the Firebase Console for this project. Please sign in with Google or enable Email/Password under Firebase Console → Authentication → Sign-in method.'
        );
      }
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const logout = async () => {
    await signOut(auth);
  };

  const becomeCreator = async (bio: string, preferredLanguage: string) => {
    if (!user) throw new Error('Sign in required');
    if (isSuspended) throw new Error('Suspended accounts cannot activate creator channels.');
    if (profile?.channelStatus === 'suspended' || profile?.channelStatus === 'deleted') {
      throw new Error('This creator channel cannot be self-activated while suspended or deleted.');
    }
    const publicRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(publicRef, {
        isCreator: true,
        isEarlyCreator: true,
        bio: bio.slice(0, 500),
        preferredLanguage,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const updateUserProfile = async (updates: Partial<UserPublicProfile>) => {
    if (!user) throw new Error('Sign in required');
    const publicRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(publicRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const updatePrivateSettings = async (
    updates: Pick<Partial<UserPrivateAccount>, 'upiId' | 'notificationsEnabled' | 'themePreference'>
  ) => {
    if (!user) throw new Error('Sign in required');
    const privateRef = doc(db, 'users', user.uid, 'private', 'account');
    const allowedPayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (typeof updates.upiId === 'string') {
      allowedPayload.upiId = updates.upiId.trim().slice(0, 100);
    }
    if (typeof updates.notificationsEnabled === 'boolean') {
      allowedPayload.notificationsEnabled = updates.notificationsEnabled;
    }
    if (updates.themePreference === 'dark' || updates.themePreference === 'light') {
      allowedPayload.themePreference = updates.themePreference;
    }
    try {
      await updateDoc(privateRef, allowedPayload);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/private/account`);
    }
  };

  const getIdToken = async (forceRefresh = false) => {
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken(forceRefresh);
  };

  const reauthenticateCeo = async (password?: string): Promise<string> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('No active authenticated CEO session.');

    const hasPasswordProvider = currentUser.providerData.some((p) => p.providerId === 'password');
    if (password && currentUser.email && hasPasswordProvider) {
      const cred = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, cred);
    } else {
      await reauthenticateWithPopup(currentUser, googleProvider);
    }
    const freshToken = await currentUser.getIdToken(true);
    return freshToken;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        privateAccount,
        authReady,
        role,
        isCeo,
        isAdmin,
        isCreator,
        isSuspended,
        adminPermissions,
        hasAdminPermission,
        signInWithGoogle,
        loginWithEmail,
        registerWithEmail,
        resetPassword,
        logout,
        becomeCreator,
        updateUserProfile,
        updatePrivateSettings,
        getIdToken,
        reauthenticateCeo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
