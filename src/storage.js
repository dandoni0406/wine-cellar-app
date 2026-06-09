// ── Storage abstraction (Firebase Firestore) ─────────────────────
// localStorage 버전에서 Firebase 실시간 동기화 버전으로 교체.
// App.jsx는 window.storage 인터페이스만 사용하므로 이 파일 교체만으로 완료.
//
// 라벨 사진(Base64)은 cellar/main 문서에 넣지 않고 images/{id} 별도 문서로 분리.
// → main 문서가 1MB 한도를 넘지 않도록 보호 (사진이 쌓여도 안전).

import { db } from './firebase.js';
import {
  doc, getDoc, setDoc, onSnapshot,
} from 'firebase/firestore';

// 모든 와인/노트 데이터 → cellar/main 문서 하나에 저장
// 설정 → cellar/settings 문서
const MAIN_DOC     = doc(db, 'cellar', 'main');
const SETTINGS_DOC = doc(db, 'cellar', 'settings');

let _unsubscribe = null;

export const storage = {
  // 읽기
  async get(key) {
    try {
      const ref  = key === 'wine-cellar-settings' ? SETTINGS_DOC : MAIN_DOC;
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const data = snap.data();
      if (key === 'wine-cellar-settings') {
        return { key, value: JSON.stringify(data) };
      }
      return {
        key,
        value: JSON.stringify({
          wines: data.wines || [],
          notes: data.notes || [],
        }),
      };
    } catch (e) {
      console.error('[storage.get]', e);
      return null;
    }
  },

  // 쓰기
  async set(key, value) {
    try {
      const ref  = key === 'wine-cellar-settings' ? SETTINGS_DOC : MAIN_DOC;
      const data = JSON.parse(value);
      await setDoc(
        ref,
        { ...data, _updatedAt: new Date().toISOString() },
        { merge: true },
      );
      return { key, value };
    } catch (e) {
      console.error('[storage.set]', e);
      return null;
    }
  },

  async delete() { return null; },
  async list(prefix = '') { return { keys: [], prefix }; },

  // 실시간 동기화 구독
  // 다른 기기에서 데이터가 바뀌면 callback({ wines, notes }) 호출됨
  subscribe(callback) {
    if (_unsubscribe) _unsubscribe();
    _unsubscribe = onSnapshot(MAIN_DOC, (snap) => {
      if (!snap.exists()) return;
      // hasPendingWrites = true면 내가 방금 쓴 것 → 무시(이미 React state에 반영됨)
      if (snap.metadata.hasPendingWrites) return;
      const data = snap.data();
      callback({ wines: data.wines || [], notes: data.notes || [] });
    });
  },

  // ── 라벨 사진 전용 (images/{id} 별도 문서) ──────────────────
  // 사진 1장당 문서 1개. main 문서 용량과 분리되어 안전.
  // 이미지 Base64는 보통 100~300KB → 문서 1MB 한도 내.

  // 사진 저장 → 새 이미지 ID 반환 (와인 데이터엔 이 ID만 저장)
  async setImage(dataUrl) {
    try {
      const id = 'img_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      await setDoc(doc(db, 'images', id), { data: dataUrl, createdAt: new Date().toISOString() });
      return id;
    } catch (e) {
      console.error('[storage.setImage]', e);
      return null;
    }
  },

  // 사진 불러오기 (ID → Base64 dataUrl)
  async getImage(id) {
    try {
      if (!id) return null;
      const snap = await getDoc(doc(db, 'images', id));
      if (!snap.exists()) return null;
      return snap.data().data || null;
    } catch (e) {
      console.error('[storage.getImage]', e);
      return null;
    }
  },
};

if (typeof window !== 'undefined' && !window.storage) {
  window.storage = storage;
}
