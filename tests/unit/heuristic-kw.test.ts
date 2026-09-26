import { describe, expect, it } from 'vitest';
import { KW, LOGIN } from '../../src/simulator/heuristic.js';

describe('heuristic buyer keywords are multilingual (ES · EN · NL)', () => {
  it.each([
    // price
    ['Pricing', 'price'],
    ['Plans', 'price'],
    ['Precios', 'price'],
    ['Tarifas', 'price'],
    ['Prijs', 'price'],
    ['Plannen', 'price'],
    ['Kosten', 'price'],
    ['Abonnement', 'price'],
    // cta / commit
    ['Start free trial', 'cta'],
    ['Get started', 'cta'],
    ['Empieza gratis', 'cta'],
    ['Prueba gratis', 'cta'],
    ['Crear una cuenta', 'cta'],
    ['Registrarse', 'cta'],
    ['Comprar ahora', 'cta'],
    ['Pagar', 'cta'],
    ['Starten', 'cta'],
    ['Account aanmaken', 'cta'],
    ['Aanmelden', 'cta'],
    ['Kopen', 'cta'],
    ['Afrekenen', 'cta'],
    ['Doorgaan', 'cta'],
    // trust
    ['Refund policy', 'trust'],
    ['Garantía de devolución', 'trust'],
    ['Reembolso', 'trust'],
    ['Garantie', 'trust'],
    ['Geld terug', 'trust'],
    ['Condiciones', 'trust'],
    ['Voorwaarden', 'trust'],
    ['Veelgestelde vragen', 'trust'],
    // explore
    ['Features', 'explore'],
    ['Características', 'explore'],
    ['Funciones', 'explore'],
    ['Functies', 'explore'],
    ['Cómo funciona', 'explore'],
    ['Hoe het werkt', 'explore'],
    ['Más información', 'explore'],
    ['Meer info', 'explore'],
    // avoid
    ['Sign in', 'avoid'],
    ['Iniciar sesión', 'avoid'],
    ['Inloggen', 'avoid'],
    ['Privacidad', 'avoid'],
    ['Vacatures', 'avoid'],
    // sales
    ['Request demo', 'sales'],
    ['Contacto', 'sales'],
    ['Ventas', 'sales'],
    ['Verkoop', 'sales'],
    // close
    ['No thanks', 'close'],
    ['No gracias', 'close'],
    ['Nee bedankt', 'close'],
    ['Cerrar', 'close'],
    ['Sluiten', 'close'],
    ['Saltar', 'close'],
    ['Overslaan', 'close'],
    // menu
    ['Menu', 'menu'],
    ['Menú', 'menu'],
    ['Navegación', 'menu'],
    ['Navigatie', 'menu'],
  ] as const)('recognises "%s" as %s', (text, cat) => {
    expect(KW[cat].test(text), `${cat} should match "${text}"`).toBe(true);
  });

  it('keeps login affordances out of the commit/cta class', () => {
    expect(LOGIN.test('Sign in')).toBe(true);
    expect(LOGIN.test('Iniciar sesión')).toBe(true);
    expect(LOGIN.test('Inloggen')).toBe(true);
    expect(LOGIN.test('Entrar')).toBe(true);
    expect(LOGIN.test('Acceder')).toBe(true);
    expect(LOGIN.test('Sign up')).toBe(false);
    expect(LOGIN.test('Registrarse')).toBe(false);
    expect(LOGIN.test('Aanmelden')).toBe(false);
    expect(LOGIN.test('Crear cuenta')).toBe(false);
  });
});
