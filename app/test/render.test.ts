import { describe, expect, it } from 'vitest';
import { excerpt, plainText, renderIntervention, wordCount } from '../src/lib/render.ts';

describe('renderIntervention (D7)', () => {
  it('renders bold, italic and paragraphs', () => {
    expect(renderIntervention('Je propose un **amendement** *urgent*.')).toBe(
      '<p>Je propose un <strong>amendement</strong> <em>urgent</em>.</p>',
    );
    expect(renderIntervention('Ligne 1\nLigne 2')).toBe('<p>Ligne 1</p><p>Ligne 2</p>');
  });

  it('renders consecutive "- " lines as one bulleted list', () => {
    expect(renderIntervention('Trois points :\n- le **budget**\n- la cantine\n• la formation\nMerci')).toBe(
      '<p>Trois points :</p><ul><li>le <strong>budget</strong></li><li>la cantine</li><li>la formation</li></ul><p>Merci</p>',
    );
    expect(renderIntervention('- a\n\n- b')).toBe('<ul><li>a</li></ul><ul><li>b</li></ul>');
  });

  it('shows HTML and scripts literally', () => {
    const html = renderIntervention('<script>alert("x")</script> <img src=x onerror=alert(1)> & \'q\'');
    expect(html).toBe(
      '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &lt;img src=x onerror=alert(1)&gt; &amp; &#39;q&#39;</p>',
    );
    expect(html).not.toMatch(/<(script|img)/);
  });

  it('does not let markers produce attributes or unescaped markup', () => {
    const html = renderIntervention('**<b onclick="x">gras</b>** *"><svg onload=1>*');
    expect(html).not.toMatch(/<(b|svg)\b/);
    expect(html).toContain('<strong>&lt;b onclick=&quot;x&quot;&gt;gras&lt;/b&gt;</strong>');
  });

  it('leaves unbalanced markers as text', () => {
    expect(renderIntervention('**pas fermé')).toBe('<p>**pas fermé</p>');
    expect(renderIntervention('un * seul')).toBe('<p>un * seul</p>');
    expect(renderIntervention('***')).toBe('<p>***</p>');
    expect(renderIntervention('-sans espace')).toBe('<p>-sans espace</p>');
    expect(renderIntervention('5 * 3 = 15 et 2 * 2')).toBe('<p>5 <em> 3 = 15 et 2 </em> 2</p>');
  });

  it('handles empty input and Windows line breaks', () => {
    expect(renderIntervention('')).toBe('');
    expect(renderIntervention('\n  \n')).toBe('');
    expect(renderIntervention('a\r\n- b\r\n')).toBe('<p>a</p><ul><li>b</li></ul>');
  });
});

describe('plain text helpers', () => {
  it('strips markers, counts words and cuts excerpts on a word', () => {
    expect(plainText('**Trois** points :\n- *un*\n- deux')).toBe('Trois points : • un • deux');
    expect(wordCount('**Trois** points :\n- un\n- deux')).toBe(5);
    const long = 'mot '.repeat(100).trim();
    const cut = excerpt(long);
    expect(cut.endsWith(' …')).toBe(true);
    expect(cut.length).toBeLessThanOrEqual(232);
    expect(cut).not.toMatch(/mo …$/);
  });
});
