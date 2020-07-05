module.exports = () => ({
  prepare: () => Promise.resolve(),
  getRequestHandler: () => (req, res) => res.status(404).send('Not found')
})
