import chance from 'chance';
import { client } from './client';

function create(cert: string) {
  return {
    uid: `dummy-${cert}.cert`,
    created: chance().timestamp(),
    expiration: chance().timestamp(),
    renew: chance().bool(),
    cns: [chance().domain()],
    age: chance().integer({ min: 0, max: 1000 }),
  };
}

export function useCert() {
  client.scenario.get('/v4/now/certs', (_req, res) => {
    const limit = parseInt(_req.query.limit);
    const certs = Array.from({ length: limit }, (v, i) => create(`${i}`));
    res.json({
      certs: certs,
      pagination: { count: limit, total: limit, page: 1, pages: 1 },
    });
  });

  client.scenario.get('/v6/certs/:id', (req, res) => {
    const cert = create(req.params.id);
    res.json(cert);
  });

  client.scenario.delete('/v5/certs/:id', (req, res) => {
    res.json({});
  });
}
