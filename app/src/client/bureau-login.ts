import { pageData } from './_page.ts';

// Show/hide the password (the button stays hidden without JavaScript).
const strings = pageData<{ show: string; hide: string }>();
const input = document.getElementById('password') as HTMLInputElement | null;
const toggle = document.querySelector<HTMLButtonElement>('[data-toggle-password]');
if (input && toggle) {
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.setAttribute('aria-label', show ? strings.hide : strings.show);
  });
}
