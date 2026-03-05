/** Standard result type for action operations */
export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Common inputs all actions may receive */
export interface CommonInputs {
  /** GitHub token for API calls */
  githubToken: string;
}

/** Represents a GitHub repository */
export interface Repository {
  owner: string;
  name: string;
  fullName: string;
}
