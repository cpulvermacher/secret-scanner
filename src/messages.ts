import type { ScriptFetchError, SecretResult } from "./background";

export type Message =
    | ScriptDetectedMessage
    | SecretsDetectedMessage
    | ErrorWhenFetchingScriptMessage
    | UserActionMessage;

export type ScriptDetectedMessage = {
    type: "scriptDetected";
    documentUrl: string; // page where the script was found
} & ScriptSource;

type ScriptSource =
    | {
          url: string; // source script URL
      }
    | {
          content: string;
      };

export type SecretsDetectedMessage = {
    type: "secretsDetected";
    results: SecretResult[];
};

export type ErrorWhenFetchingScriptMessage = {
    type: "errorWhenFetchingScript";
    errors: ScriptFetchError[];
};

export type UserActionMessage = {
    type: "userAction";
    action: UserAction;
    tabId: number;
};

export type UserAction = "startDebugger" | "stopDebugger" | "getStatus";
