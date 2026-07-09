// src/hooks/useResourceLinkHandler.js
// Shared click handler for the "Link to associated CRG resource" link that the
// sync script generates from an announcement's directory_id_no cell (see
// scripts/sync-to-supabase.js `buildResourceLink`). Announcement bodies are
// rendered via dangerouslySetInnerHTML, so we attach ONE onClick to the
// container and detect the internal link on the way up.
//
// There is NO special results path: we reproduce exactly what a user could type
// into "Ask a Question" — "Show me id_no 1256, 147, 3" — and flip the existing
// pendingLlmAutoSearch trigger. The normal LLM search then runs (the /llm-search
// function understands id_no lookups) and renders the records. Works for guests
// and registered users alike; no session downgrade (no guest=1).

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../Contexts/AppDataContext';

// Extract the numeric id list from an internal "/find?ids=1256,147,3" href.
function parseIdsFromHref(href) {
  try {
    const url = new URL(href, window.location.origin);
    const idsParam = url.searchParams.get('ids');
    if (!idsParam) return [];
    return idsParam
      .split(',')
      .map(s => s.trim())
      .filter(s => /^\d+$/.test(s));
  } catch {
    return [];
  }
}

/**
 * @param {Function} [onNavigate] - called after a successful intercept (e.g. to
 *   close the announcement popup). No-op for the archive page.
 * @returns {Function} an onClick handler to spread onto the rendered HTML container.
 */
export default function useResourceLinkHandler(onNavigate) {
  const navigate = useNavigate();
  const { setActiveSearchMode, setLlmSearchQuery, setPendingLlmAutoSearch } = useAppData();

  return useCallback(
    (event) => {
      const anchor = event.target.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href') || '';
      // Only intercept our internal resource link; external links (target=_blank)
      // keep their normal new-tab behavior.
      if (!href.startsWith('/find')) return;

      const ids = parseIdsFromHref(href);
      if (ids.length === 0) return;

      event.preventDefault();

      // Set mode directly (NOT via handleModeChange, which clears LLM state),
      // then populate the query and fire the existing auto-run trigger.
      setActiveSearchMode('llm');
      setLlmSearchQuery(`Show me id_no ${ids.join(', ')}`);
      setPendingLlmAutoSearch(true);
      navigate('/find');
      onNavigate?.();
    },
    [navigate, setActiveSearchMode, setLlmSearchQuery, setPendingLlmAutoSearch, onNavigate]
  );
}
