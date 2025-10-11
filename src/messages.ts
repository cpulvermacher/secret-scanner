export type Message = ScriptDetectedMessage | UserActionMessage;

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

export type UserActionMessage = {
    type: "userAction";
    action: UserAction;
    tabId: number;
};

export type UserAction = "startDebugger" | "stopDebugger" | "getStatus";
