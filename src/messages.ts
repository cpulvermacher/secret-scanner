export type Message =
    | ScriptDetectedMessage
    | SecretsDetectedMessage
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
    //TODO
};

export interface UserActionMessage {
    type: "userAction";
    action: string;
    tabId: number;
}
