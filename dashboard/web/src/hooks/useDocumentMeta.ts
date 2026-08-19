import { useEffect } from "react";

interface DocumentMetaOptions {
  title: string;
  description?: string;
  noindex?: boolean;
}

function upsertMeta(name: string, content: string) {
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function removeMeta(name: string) {
  document.querySelector(`meta[name="${name}"]`)?.remove();
}

/** Sets document.title and a meta description for the lifetime of the
 * mounted route, restoring the previous values on unmount. index.html's
 * static tags remain the default for "/" and any route that doesn't call
 * this hook. */
export function useDocumentMeta({ title, description, noindex }: DocumentMetaOptions) {
  useEffect(() => {
    const previousTitle = document.title;
    const previousDescription = document
      .querySelector('meta[name="description"]')
      ?.getAttribute("content");

    document.title = title;
    if (description) {
      upsertMeta("description", description);
    }
    if (noindex) {
      upsertMeta("robots", "noindex");
    }

    return () => {
      document.title = previousTitle;
      if (description) {
        if (previousDescription != null) {
          upsertMeta("description", previousDescription);
        } else {
          removeMeta("description");
        }
      }
      if (noindex) removeMeta("robots");
    };
  }, [title, description, noindex]);
}
