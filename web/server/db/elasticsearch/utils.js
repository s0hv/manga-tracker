export const handleElasticError = (err, res) => {
  const error = 'Internal server error';
  console.error(err);
  res.status(500).json({ error });
};

export const extractFields = (result, fields, idPrefix, customFieldFormatter) => {
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

      if (customFieldFormatter) {
        const formatted = customFieldFormatter(hit.fields);
        Object.keys(formatted).forEach(k => { o[k] = formatted[k] });
      }
    }

    return o;
  });
};
