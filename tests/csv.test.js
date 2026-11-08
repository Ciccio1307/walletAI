import { describe, it, expect } from 'vitest';
import { csvEscape, csvUnescapeFormula, parseCSV } from '../src/utils/csv.js';

describe('CSV', () => {
  it('gestisce virgole, virgolette e a capo dentro le celle', () => {
    const line = [csvEscape('pizza, birra'), csvEscape('detto "ottimo"'), csvEscape('riga1\nriga2')].join(',');
    expect(parseCSV(`a,b,c\r\n${line}\r\n`)).toEqual([
      ['a', 'b', 'c'],
      ['pizza, birra', 'detto "ottimo"', 'riga1\nriga2'],
    ]);
  });

  it('ignora BOM e righe vuote', () => {
    expect(parseCSV('\uFEFFx,y\n\n1,2\n')).toEqual([['x', 'y'], ['1', '2']]);
  });

  it('neutralizza le formule (CSV injection) e le ripristina in import', () => {
    const escaped = csvEscape('=HYPERLINK("http://evil")');
    expect(escaped.startsWith(`"'=`)).toBe(true);
    const [[cell]] = parseCSV(escaped);
    expect(csvUnescapeFormula(cell)).toBe('=HYPERLINK("http://evil")');
  });

  it('lascia intatti i testi normali', () => {
    expect(csvUnescapeFormula("l'altro ieri")).toBe("l'altro ieri");
    expect(csvEscape('sushi')).toBe('"sushi"');
  });
});
