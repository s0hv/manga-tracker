import { csrfToken } from '../__tests__/constants';

const Token = jest.requireActual('csrf');
jest.spyOn(Token.prototype, 'create').mockImplementation(() => csrfToken);
jest.spyOn(Token.prototype, 'verify').mockImplementation((secret, token) => token === csrfToken);
jest.spyOn(Token.prototype, 'secretSync').mockImplementation(() => 'secret');

module.exports = Token;
