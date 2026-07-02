import { startBot } from './handlers/commands.js';
startBot().catch((error) => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map