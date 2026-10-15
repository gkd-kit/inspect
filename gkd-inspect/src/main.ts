import {
  installGlobalErrorHandlers,
  reportGlobalError,
} from './shared/services/globalError.ts';

installGlobalErrorHandlers();

void import('./app/bootstrap.ts').catch((error: unknown) => {
  reportGlobalError(error, '应用启动');
});
