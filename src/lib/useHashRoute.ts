import { useEffect, useState } from 'react';

export interface Route {
  /** full slug after the hash — "" | "buttons" | "buttons/fill-sweep" */
  slug: string;
  /** slug split on "/" — [] for home */
  segs: string[];
  raw: string;
}

function read(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const slug = raw.split('?')[0].replace(/\/+$/, '');
  return { slug, segs: slug ? slug.split('/').filter(Boolean) : [], raw };
}

export function navigate(path: string): void {
  window.location.hash = path ? `#/${path.replace(/^\/+/, '')}` : '#/';
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(read);

  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
