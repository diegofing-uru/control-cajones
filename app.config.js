// Extiende app.json. Para la demo web, DEMO_BASE_URL indica la carpeta donde se publica
// (por ejemplo /control-cajones en GitHub Pages) para que las rutas no se salgan de ahí.
module.exports = ({ config }) => {
  const baseUrl = process.env.DEMO_BASE_URL;
  if (!baseUrl) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl } };
};
