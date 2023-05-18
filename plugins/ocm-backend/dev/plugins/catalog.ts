import { CatalogBuilder } from '@backstage/plugin-catalog-backend';
import { ManagedClusterProvider } from '@janus-idp/backstage-plugin-ocm-backend';
import { ScaffolderEntitiesProcessor } from '@backstage/plugin-scaffolder-backend';
import { Router } from 'express';
import { PluginEnvironment } from '../types';

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  const builder = CatalogBuilder.create(env);
  const ocm = ManagedClusterProvider.fromConfig(env.config, {
    logger: env.logger,
  });
  builder.addEntityProvider(ocm);

  builder.addProcessor(new ScaffolderEntitiesProcessor());
  const { processingEngine, router } = await builder.build();
  await processingEngine.start();
  await Promise.all(
    ocm.map(o =>
      env.scheduler.scheduleTask({
        id: `run_ocm_refresh_${o.getProviderName()}`,
        fn: async () => {
          await o.run();
        },
        frequency: { minutes: 30 },
        timeout: { minutes: 10 },
      }),
    ),
  );

  return router;
}
