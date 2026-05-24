const SKILL_MAP: Record<string, string> = {
  // Web fundamentals
  css: 'CSS', css3: 'CSS3', html: 'HTML', html5: 'HTML5',
  xml: 'XML', json: 'JSON', svg: 'SVG', sass: 'Sass', less: 'Less',
  // Languages
  javascript: 'JavaScript', js: 'JavaScript',
  typescript: 'TypeScript', ts: 'TypeScript',
  python: 'Python', java: 'Java',
  'c#': 'C#', csharp: 'C#',
  'c++': 'C++', cpp: 'C++', 'c/c++': 'C/C++',
  php: 'PHP', ruby: 'Ruby', swift: 'Swift', kotlin: 'Kotlin',
  go: 'Go', rust: 'Rust', scala: 'Scala',
  r: 'R', matlab: 'MATLAB', perl: 'Perl', lua: 'Lua',
  sql: 'SQL', plsql: 'PL/SQL',
  // Frontend frameworks & libraries
  react: 'React', 'react.js': 'React.js', reactjs: 'React.js',
  'react native': 'React Native', reactnative: 'React Native',
  vue: 'Vue.js', 'vue.js': 'Vue.js', vuejs: 'Vue.js',
  angular: 'Angular', angularjs: 'AngularJS',
  'next.js': 'Next.js', nextjs: 'Next.js',
  'nuxt.js': 'Nuxt.js', nuxtjs: 'Nuxt.js', nuxt: 'Nuxt.js',
  svelte: 'Svelte', jquery: 'jQuery', backbone: 'Backbone.js',
  redux: 'Redux', mobx: 'MobX', zustand: 'Zustand',
  // CSS frameworks
  bootstrap: 'Bootstrap', tailwind: 'Tailwind CSS',
  tailwindcss: 'Tailwind CSS', 'tailwind css': 'Tailwind CSS',
  materialize: 'Materialize', bulma: 'Bulma',
  // Backend frameworks
  django: 'Django', flask: 'Flask', fastapi: 'FastAPI',
  spring: 'Spring', 'spring boot': 'Spring Boot', springboot: 'Spring Boot',
  rails: 'Ruby on Rails', 'ruby on rails': 'Ruby on Rails',
  express: 'Express.js', 'express.js': 'Express.js', expressjs: 'Express.js',
  nestjs: 'NestJS', 'nest.js': 'NestJS',
  laravel: 'Laravel', symfony: 'Symfony', codeigniter: 'CodeIgniter',
  'asp.net': 'ASP.NET', aspnet: 'ASP.NET', dotnet: '.NET', '.net': '.NET',
  // Databases
  mysql: 'MySQL', postgresql: 'PostgreSQL', postgres: 'PostgreSQL',
  mongodb: 'MongoDB', redis: 'Redis', sqlite: 'SQLite',
  oracle: 'Oracle', mssql: 'MS SQL Server', sqlserver: 'SQL Server',
  cassandra: 'Cassandra', dynamodb: 'DynamoDB', firebase: 'Firebase',
  elasticsearch: 'Elasticsearch', neo4j: 'Neo4j', couchdb: 'CouchDB',
  // Cloud & DevOps
  aws: 'AWS', azure: 'Azure', gcp: 'GCP',
  docker: 'Docker', kubernetes: 'Kubernetes', k8s: 'Kubernetes',
  terraform: 'Terraform', ansible: 'Ansible', vagrant: 'Vagrant',
  jenkins: 'Jenkins', circleci: 'CircleCI', travis: 'Travis CI',
  git: 'Git', github: 'GitHub', gitlab: 'GitLab', bitbucket: 'Bitbucket',
  linux: 'Linux', unix: 'Unix', bash: 'Bash', shell: 'Shell',
  nginx: 'Nginx', apache: 'Apache', tomcat: 'Tomcat',
  // AI / ML / Data
  tensorflow: 'TensorFlow', pytorch: 'PyTorch', keras: 'Keras',
  sklearn: 'scikit-learn', 'scikit-learn': 'scikit-learn', 'scikit learn': 'scikit-learn',
  'machine learning': 'Machine Learning', ml: 'Machine Learning',
  'deep learning': 'Deep Learning', dl: 'Deep Learning',
  nlp: 'NLP', cv: 'Computer Vision', 'computer vision': 'Computer Vision',
  opencv: 'OpenCV', pandas: 'Pandas', numpy: 'NumPy',
  matplotlib: 'Matplotlib', seaborn: 'Seaborn', scipy: 'SciPy',
  tableau: 'Tableau', powerbi: 'Power BI', 'power bi': 'Power BI',
  // Mobile
  flutter: 'Flutter', ionic: 'Ionic', android: 'Android', ios: 'iOS',
  xcode: 'Xcode', 'android studio': 'Android Studio',
  // Testing
  jest: 'Jest', cypress: 'Cypress', selenium: 'Selenium',
  mocha: 'Mocha', chai: 'Chai', pytest: 'pytest',
  junit: 'JUnit', jasmine: 'Jasmine', karma: 'Karma',
  // Build tools
  webpack: 'Webpack', vite: 'Vite', babel: 'Babel',
  eslint: 'ESLint', prettier: 'Prettier', gulp: 'Gulp', grunt: 'Grunt',
  npm: 'npm', yarn: 'Yarn', pnpm: 'pnpm',
  // APIs & protocols
  graphql: 'GraphQL', rest: 'REST', restapi: 'REST API',
  'rest api': 'REST API', api: 'API', grpc: 'gRPC',
  oauth: 'OAuth', 'oauth 2.0': 'OAuth 2.0', jwt: 'JWT',
  websocket: 'WebSocket', websockets: 'WebSocket',
  // Practices
  'ci/cd': 'CI/CD', cicd: 'CI/CD', devops: 'DevOps',
  agile: 'Agile', scrum: 'Scrum', kanban: 'Kanban',
  tdd: 'TDD', bdd: 'BDD',
  microservices: 'Microservices', soa: 'SOA',
  mvc: 'MVC', oop: 'OOP', ddd: 'DDD',
  // Design & other
  figma: 'Figma', 'adobe xd': 'Adobe XD', sketch: 'Sketch',
  ui: 'UI', ux: 'UX', 'ui/ux': 'UI/UX',
  photoshop: 'Photoshop', illustrator: 'Illustrator',
  // Microsoft
  excel: 'Excel', word: 'Word', powerpoint: 'PowerPoint',
  sharepoint: 'SharePoint', 'visual studio': 'Visual Studio',
  vscode: 'VS Code', 'vs code': 'VS Code',
  // Other popular tools
  jira: 'Jira', confluence: 'Confluence', slack: 'Slack',
  postman: 'Postman', swagger: 'Swagger', openapi: 'OpenAPI',
  kafka: 'Kafka', rabbitmq: 'RabbitMQ', celery: 'Celery',
};

export function formatSkill(skill: string): string {
  const lower = skill.toLowerCase().trim();
  if (SKILL_MAP[lower]) return SKILL_MAP[lower];
  return skill.replace(/\b\w/g, (c) => c.toUpperCase());
}
