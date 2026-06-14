import { webAppMode } from "../../deployment";
import { ControlPlaneTaskRoom } from "./control-plane-task-room";

export default async function TaskPage({ params }: { params: { taskId: string } }) {
  if (webAppMode() === "control-plane") {
    return <ControlPlaneTaskRoom taskId={params.taskId} />;
  }

  const { LocalTaskPage } = await import("./local-task-page");
  return <LocalTaskPage params={params} />;
}
