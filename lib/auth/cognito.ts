import { createHmac } from "node:crypto";
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  type AuthenticationResultType,
} from "@aws-sdk/client-cognito-identity-provider";

export class CognitoAuthError extends Error {
  constructor(
    message: string,
    readonly code = "COGNITO_AUTH_ERROR",
  ) {
    super(message);
  }
}

function client() {
  const region = process.env.COGNITO_REGION;
  if (!region) throw new Error("COGNITO_REGION is required");
  return new CognitoIdentityProviderClient({ region });
}

function clientId() {
  const id = process.env.COGNITO_APP_CLIENT_ID;
  if (!id) throw new Error("COGNITO_APP_CLIENT_ID is required");
  return id;
}

/**
 * This app client has a client secret (confirmed in the Cognito console),
 * so every unauthenticated API call must include a SECRET_HASH computed
 * from it — Cognito otherwise rejects the call as NotAuthorizedException,
 * even on operations like SignUp that aren't really about authorization.
 */
function secretHash(username: string): string {
  const secret = process.env.COGNITO_APP_CLIENT_SECRET;
  if (!secret) throw new Error("COGNITO_APP_CLIENT_SECRET is required");
  return createHmac("sha256", secret)
    .update(username + clientId())
    .digest("base64");
}

function wrap<T>(promise: Promise<T>): Promise<T> {
  return promise.catch((error: unknown) => {
    const name = error instanceof Error ? error.name : "UnknownError";
    const message =
      error instanceof Error ? error.message : "Authentication failed";
    if (name === "UsernameExistsException") {
      throw new CognitoAuthError(
        "An account with this email already exists.",
        "ACCOUNT_EXISTS",
      );
    }
    if (name === "NotAuthorizedException") {
      throw new CognitoAuthError(
        "Incorrect email, password, or code.",
        "NOT_AUTHORIZED",
      );
    }
    if (name === "CodeMismatchException") {
      throw new CognitoAuthError("That code is incorrect.", "CODE_MISMATCH");
    }
    if (name === "ExpiredCodeException") {
      throw new CognitoAuthError(
        "That code has expired. Request a new one.",
        "CODE_EXPIRED",
      );
    }
    if (name === "UserNotConfirmedException") {
      throw new CognitoAuthError(
        "Confirm your email before signing in.",
        "NOT_CONFIRMED",
      );
    }
    if (name === "InvalidPasswordException") {
      throw new CognitoAuthError(message, "INVALID_PASSWORD");
    }
    if (name === "LimitExceededException" || name === "TooManyRequestsException") {
      throw new CognitoAuthError(
        "Too many attempts. Wait a few minutes and try again.",
        "RATE_LIMITED",
      );
    }
    if (name === "UserNotFoundException") {
      throw new CognitoAuthError("No account matches that email.", "USER_NOT_FOUND");
    }
    throw new CognitoAuthError(message, "COGNITO_AUTH_ERROR");
  });
}

export async function signUp(
  email: string,
  password: string,
  name: string,
): Promise<{ userSub: string; confirmed: boolean }> {
  const result = await wrap(
    client().send(
      new SignUpCommand({
        ClientId: clientId(),
        Username: email,
        Password: password,
        SecretHash: secretHash(email),
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "name", Value: name },
        ],
      }),
    ),
  );
  return {
    userSub: result.UserSub!,
    confirmed: result.UserConfirmed ?? false,
  };
}

export async function confirmSignUp(
  email: string,
  code: string,
): Promise<void> {
  await wrap(
    client().send(
      new ConfirmSignUpCommand({
        ClientId: clientId(),
        Username: email,
        ConfirmationCode: code,
        SecretHash: secretHash(email),
      }),
    ),
  );
}

export async function resendConfirmationCode(email: string): Promise<void> {
  await wrap(
    client().send(
      new ResendConfirmationCodeCommand({
        ClientId: clientId(),
        Username: email,
        SecretHash: secretHash(email),
      }),
    ),
  );
}

/**
 * Starts a password reset — Cognito emails a recovery code.
 *
 * Callers must not turn a failure here into a different answer than a success,
 * or the endpoint becomes a way to test which email addresses have accounts.
 */
export async function startPasswordReset(email: string): Promise<void> {
  await wrap(
    client().send(
      new ForgotPasswordCommand({
        ClientId: clientId(),
        Username: email,
        SecretHash: secretHash(email),
      }),
    ),
  );
}

/** Completes a password reset with the emailed code and the new password. */
export async function completePasswordReset(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  await wrap(
    client().send(
      new ConfirmForgotPasswordCommand({
        ClientId: clientId(),
        Username: email,
        ConfirmationCode: code,
        Password: newPassword,
        SecretHash: secretHash(email),
      }),
    ),
  );
}

export type AuthChallenge = {
  challengeName: string;
  session: string;
};

export type AuthOutcome =
  | { kind: "authenticated"; tokens: AuthenticationResultType }
  | { kind: "challenge"; challenge: AuthChallenge };

function toOutcome(result: {
  AuthenticationResult?: AuthenticationResultType;
  ChallengeName?: string;
  Session?: string;
}): AuthOutcome {
  if (result.AuthenticationResult) {
    return { kind: "authenticated", tokens: result.AuthenticationResult };
  }
  if (result.ChallengeName && result.Session) {
    return {
      kind: "challenge",
      challenge: { challengeName: result.ChallengeName, session: result.Session },
    };
  }
  throw new CognitoAuthError(
    "Authentication did not complete.",
    "AUTH_INCOMPLETE",
  );
}

/** Starts sign-in with a password via the USER_AUTH choice-based flow. */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<AuthOutcome> {
  const result = await wrap(
    client().send(
      new InitiateAuthCommand({
        AuthFlow: "USER_AUTH",
        ClientId: clientId(),
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
          PREFERRED_CHALLENGE: "PASSWORD",
          SECRET_HASH: secretHash(email),
        },
      }),
    ),
  );
  return toOutcome(result);
}

/** Starts passwordless sign-in — Cognito emails a one-time code immediately. */
export async function requestEmailOtp(email: string): Promise<AuthChallenge> {
  const result = await wrap(
    client().send(
      new InitiateAuthCommand({
        AuthFlow: "USER_AUTH",
        ClientId: clientId(),
        AuthParameters: {
          USERNAME: email,
          PREFERRED_CHALLENGE: "EMAIL_OTP",
          SECRET_HASH: secretHash(email),
        },
      }),
    ),
  );
  const outcome = toOutcome(result);
  if (outcome.kind !== "challenge" || outcome.challenge.challengeName !== "EMAIL_OTP") {
    throw new CognitoAuthError(
      "Email code sign-in isn't available for this account.",
      "OTP_UNAVAILABLE",
    );
  }
  return outcome.challenge;
}

/** Completes passwordless sign-in with the code the user received by email. */
export async function verifyEmailOtp(
  email: string,
  code: string,
  session: string,
): Promise<AuthOutcome> {
  const result = await wrap(
    client().send(
      new RespondToAuthChallengeCommand({
        ClientId: clientId(),
        ChallengeName: "EMAIL_OTP",
        Session: session,
        ChallengeResponses: {
          USERNAME: email,
          EMAIL_OTP_CODE: code,
          SECRET_HASH: secretHash(email),
        },
      }),
    ),
  );
  return toOutcome(result);
}
