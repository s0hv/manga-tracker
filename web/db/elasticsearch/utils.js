const handleElasticError = (err, res) => {
  const error = 'Internal server error';
  console.error(err);
  res.status(500).json({ error });
};

const extractFields = (result, fields, idPrefix) => {
  idPrefix = idPrefix ? `${idPrefix}_` : '';
  return result.body.hits.hits.map(hit => {
    const o = {
      [`${idPrefix}id`]: Number(hit._id),
      score: hit._score,
    };
    if (fields) {
      fields.forEach(field => {
        o[field] = (hit.fields[field] || [])[0];
      });
    }

    return o;
  });
};

module.exports = {
  handleElasticError,
  extractFields,
};
