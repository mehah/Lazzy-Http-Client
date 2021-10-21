import { HttpClient, HttpHandler, HttpXhrBackend } from '@angular/common/http';
import { Injector } from '@angular/core';
import { take, tap } from 'rxjs/operators';

let HTTP_CLIENT: HttpClient;

export class LazyHttpClientFactor {
  static get client(): HttpClient {
    if (!HTTP_CLIENT) {
      const injector = Injector.create({
        providers: [
          { provide: HttpClient, deps: [HttpHandler] },
          { provide: HttpHandler, useValue: new HttpXhrBackend({ build: () => new XMLHttpRequest }) },
        ],
      });

      HTTP_CLIENT = injector.get(HttpClient);
    }

    return HTTP_CLIENT;
  }

  static set client(httpClient: HttpClient) {
    HTTP_CLIENT = httpClient;
  }
}

const action = function (methodName: string, paths: string | string[], options?: RequestOption) {
  const path = typeof paths === 'string' ? paths : paths.join('');
  const vars = [];

  let pos = path.indexOf(':');
  while (pos != -1) {
    let last = path.indexOf('/', pos);
    if (last === -1) last = undefined;

    const $var = path.substring(pos, last);
    vars.push($var);

    if (!last) break;

    pos = last + 1;
  }

  return (target, propertyKey: string) => {
    (target as any).constructor.prototype[propertyKey] = (...args) => {
      let processedPath = path;

      for (const $var of vars) {
        processedPath = processedPath.replace($var, args[0]);
        args.shift();
      }

      if (target.constructor.defaultPathResource) {
        processedPath = target.constructor.defaultPathResource + processedPath;
      }

      options?.beforeRequest?.apply(null, args);

      args.unshift(processedPath);

      // eslint-disable-next-line prefer-spread
      return LazyHttpClientFactor.client[methodName].apply(LazyHttpClientFactor.client, args)
        .pipe(tap(ds => options?.afterRequest?.(ds)), take(1));
    }
  }
};

export function ResourcePath(path: string) {
  return (target) => {
    target.defaultPathResource = path;
  };
}


export function Get(paths: string | string[], options?: RequestOption): PropertyDecorator {
  return action('get', paths, options);
}

export function Head(paths: string | string[]): PropertyDecorator {
  return action('head', paths);
}

export function Put(paths: string | string[], options?: RequestOption): PropertyDecorator {
  return action('put', paths, options);
}

export function Delete(paths: string | string[], options?: RequestOption): PropertyDecorator {
  return action('delete', paths, options);
}

export function Post(paths: string | string[], options?: RequestOption): PropertyDecorator {
  return action('post', paths, options);
}

export function Patch(paths: string | string[], options?: RequestOption): PropertyDecorator {
  return action('patch', paths, options);
}

export class RequestOption {
  beforeRequest?: (...args: any) => void;
  afterRequest?: (dataResponse: any) => any;
}
