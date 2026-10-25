// Yes/no questions in the app's own dialog instead of the browser's confirm(),
// which cannot be styled or translated and blocks the page.
import { $ } from './dom.js';

let i18n = null;

export function bindAsk(instance) {
  i18n = instance;
}

// Resolves to true when the user clicks the OK button. okKey names that
// button's text; danger styles it as destructive.
export function ask(textKey, params = {}, { okKey = 'common.ok', danger = false } = {}) {
  const dlg = $('dlg-ask');
  $('dlg-ask-text').textContent = i18n.t(textKey, params);
  const ok = $('dlg-ask-ok');
  ok.textContent = i18n.t(okKey);
  ok.className = danger ? 'danger' : 'primary';
  return new Promise((resolve) => {
    const done = (answer) => {
      ok.onclick = null;
      $('dlg-ask-cancel').onclick = null;
      dlg.oncancel = null;
      if (dlg.open) dlg.close();
      resolve(answer);
    };
    ok.onclick = () => done(true);
    $('dlg-ask-cancel').onclick = () => done(false);
    dlg.oncancel = () => done(false);
    dlg.showModal();
    // Destructive questions start on Cancel, so Enter does not delete by accident.
    (danger ? $('dlg-ask-cancel') : ok).focus();
  });
}
