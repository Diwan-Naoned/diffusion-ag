// AG settings page: copy the participant link, confirm sensitive actions in a dialog.
import { pageData } from './_page.ts';

const strings = pageData<{ copied: string }>();

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
  if (!navigator.clipboard) continue;
  button.hidden = false;
  button.addEventListener('click', async () => {
    const status = document.querySelector('[data-copy-status]');
    try {
      await navigator.clipboard.writeText(button.dataset.copy ?? '');
      if (status) status.textContent = strings.copied;
    } catch {
      // Clipboard refused: the link stays visible to copy by hand.
    }
  });
}

const dialog = document.querySelector<HTMLDialogElement>('[data-confirm-dialog]');
if (dialog) {
  const text = dialog.querySelector<HTMLElement>('[data-confirm-text]')!;
  const yes = dialog.querySelector<HTMLButtonElement>('[data-confirm-yes]')!;
  const no = dialog.querySelector<HTMLButtonElement>('[data-confirm-no]')!;
  let pending: HTMLFormElement | null = null;

  for (const form of document.querySelectorAll<HTMLFormElement>('form[data-confirm]')) {
    form.addEventListener('submit', (e) => {
      if (form.dataset.confirmed === 'yes') return;
      e.preventDefault();
      pending = form;
      text.textContent = form.dataset.confirm ?? '';
      yes.textContent = form.dataset.confirmOk ?? 'OK';
      no.textContent = form.dataset.confirmCancel ?? '×';
      dialog.showModal();
    });
  }
  yes.addEventListener('click', () => {
    dialog.close();
    if (pending) {
      pending.dataset.confirmed = 'yes';
      pending.requestSubmit();
    }
  });
  no.addEventListener('click', () => dialog.close());
}
