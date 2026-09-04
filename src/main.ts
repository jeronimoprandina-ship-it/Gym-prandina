import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { ShellComponent } from './app/shell';

bootstrapApplication(ShellComponent, appConfig)
  .catch((err) => console.error(err));
