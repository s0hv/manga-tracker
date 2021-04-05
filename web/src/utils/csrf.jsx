import { createContext, useContext } from 'react';

const CSRFContext = createContext(undefined);
export const CSRFProvider = CSRFContext.Provider;

export const useCSRF = () => useContext(CSRFContext);

/**
 * Returns the useCSRF token in the props property with the key _csrf
 * @param req
 * @returns {{props: {_csrf: String}}}
 */
export const csrfProps = ({ req }) => ({
  props: { _csrf: req.csrfToken() },
});

export const csrfHeader = (csrf) => ({
  'X-CSRF-Token': csrf,
});
