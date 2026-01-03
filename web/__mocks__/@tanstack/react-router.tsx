import { vi } from 'vitest';
import type {
  AnyRouter,
  LinkComponent,
  RegisteredRouter,
} from '@tanstack/react-router';

type ReactRouterModule = typeof import('@tanstack/react-router');

const actualModule = await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router');
const router = actualModule.createRouter({});

module.exports = {
  ...actualModule,
  useRouter<TRouter extends AnyRouter = RegisteredRouter>() {
    return router as TRouter;
  },
  createLink(Component: any) {
    // Maps the `to` prop back to `href`
    return ({ to, ...props }) => <Component href={to} {...props} />;
  },
  useNavigate() {
    return vi.fn();
  },
} satisfies Pick<ReactRouterModule, 'useNavigate' | 'createLink' | 'useRouter'>;
