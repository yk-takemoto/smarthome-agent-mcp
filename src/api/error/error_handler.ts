export type CommonExceptionResponse = {
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export const errorHandler = (message: string, error?: unknown): CommonExceptionResponse => {
  let errorRes: CommonExceptionResponse = {
    message
  }
  if (!error) {
    return errorRes;
  }
  if (error instanceof Error) {
    errorRes.error = {
      name: error.name,
      message: error.message,
      stack: error.stack || "",
    }
  } else if (typeof error === "string") {
    errorRes.error = {
      name: "string_error",
      message: error
    }
  } else if (typeof error === "object" && error !== null) {
    errorRes.error = {
      name: "object_error",
      message: JSON.stringify(error)
    }
  } else {
    errorRes.error = {
      name: "unknown_error",
      message: "An unknown error occurred"
    }
  }
  return errorRes;
}