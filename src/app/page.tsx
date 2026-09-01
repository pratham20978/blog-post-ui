import { redirect } from "next/navigation";

/**
 * The feed is the front door. A separate marketing home page would be a second
 * place to maintain the same content, so `/` sends readers straight to it.
 */
export default function HomePage() {
  redirect("/blogs");
}
