// Teacher preview mode.
// Active only when the URL has preview=1 AND the logged-in user's profile role is 'teacher'.
// For students (or anyone else), every export here is a no-op and pages behave as before.
import { supabaseClient } from './supabase/supabaseClient.js';

const params = new URLSearchParams(window.location.search);
export const previewRequested = params.get('preview') === '1';

let cachedResult;

export async function isTeacherPreview() {
  if (!previewRequested) return false;
  if (cachedResult !== undefined) return cachedResult;

  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return (cachedResult = false);

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    cachedResult = profile?.role === 'teacher';
  } catch (err) {
    console.error('Preview check failed:', err);
    cachedResult = false;
  }

  return cachedResult;
}

// Appends preview=1 to a URL only when the current page was opened in preview.
export function withPreview(url) {
  if (!previewRequested) return url;
  return url + (url.includes('?') ? '&' : '?') + 'preview=1';
}

// Fixed banner at the bottom of the page. onSkip is optional.
export function showPreviewBanner({ skipLabel = 'Skip to next step →', onSkip } = {}) {
  if (document.getElementById('teacher-preview-banner')) return;

  const bar = document.createElement('div');
  bar.id = 'teacher-preview-banner';
  bar.setAttribute('role', 'status');
  bar.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:16px', 'transform:translateX(-50%)',
    'z-index:100000', 'display:flex', 'align-items:center', 'gap:12px',
    'padding:10px 16px', 'border-radius:999px',
    'background:rgba(106,47,82,0.95)', 'color:#fdf6e3',
    'font:600 14px/1.3 system-ui,sans-serif',
    'box-shadow:0 4px 16px rgba(0,0,0,0.25)', 'max-width:calc(100vw - 32px)'
  ].join(';');

  const label = document.createElement('span');
  label.textContent = "Teacher preview: progress isn't saved";
  bar.appendChild(label);

  if (typeof onSkip === 'function') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = skipLabel;
    btn.style.cssText = [
      'border:1px solid #d4af37', 'background:#d4af37', 'color:#3b1a2e',
      'border-radius:999px', 'padding:6px 12px', 'cursor:pointer',
      'font:700 13px/1 system-ui,sans-serif', 'white-space:nowrap'
    ].join(';');
    btn.addEventListener('click', onSkip);
    bar.appendChild(btn);
  }

  document.body.appendChild(bar);
}
