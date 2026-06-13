import { AttackTestRunner, ALL_ATTACKS } from '../src/attack-test';

describe('Chiron Attack Coverage — A1 to A15', () => {
  let runner: AttackTestRunner;
  let results: Awaited<ReturnType<typeof runner.runAll>>;

  beforeAll(async () => {
    runner = new AttackTestRunner(1);
    results = await runner.runAll();
  });

  ALL_ATTACKS.forEach(attack => {
    test(`${attack.id}: ${attack.name} (${attack.severity})`, () => {
      const result = results.find(r => r.id === attack.id);
      expect(result).toBeDefined();
      expect(result!.passed).toBe(true);
    });
  });

  test('Attack coverage summary', () => {
    const summary = runner.getSummary();
    expect(summary.total).toBe(15);
    const blocked = results.filter(r => r.detected).length;
    expect(blocked).toBe(9);
    expect(summary.passed).toBe(15);
  });
});
