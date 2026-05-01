/**
 * API: POST /api/decisions
 * Log an operator decision on a proposal or anomaly
 */

import { ObjectId } from "mongodb";
import { currentUser } from "@clerk/nextjs/server";
import { client as mongo_client } from "@/lib/mongodb";

export async function POST(request: Request) {
  try {
    let user;
    try {
      user = await currentUser();
    } catch (e) {
      console.warn("Clerk authentication not fully configured. Bypassing for dev.");
      user = { id: "dev-operator" }; // Fallback for development
    }

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    const body = await request.json();
    const { proposal_id, anomaly_id, action, comment } = body;

    if (!proposal_id && !anomaly_id) {
      return new Response(
        JSON.stringify({ error: "proposal_id or anomaly_id required" }),
        { status: 400 }
      );
    }

    const db = mongo_client.db("water_systems");

    // Log the decision
    const decision: any = {
      _id: new ObjectId(),
      operator_id: user.id,
      proposal_id,
      anomaly_id,
      action,
      timestamp: new Date(),
      comment: comment || "",
    };

    await db.collection("decisions_log").insertOne(decision);

    // If approving a proposal, update zone forecasts and pressure simulation
    if (action === "approve" && proposal_id) {
      await updateZoneStateAfterApproval(proposal_id, db);
    }

    // If acknowledging/resolving an anomaly, update its status
    if (anomaly_id && (action === "acknowledge" || action === "resolve")) {
      await db.collection("anomalies_log").updateOne(
        { _id: new ObjectId(anomaly_id) },
        { $set: { status: action === "resolve" ? "resolved" : "acknowledged" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        decision_id: decision._id.toString(),
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error("Decision logging error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to log decision",
        details: error instanceof Error ? error.message : "",
      }),
      { status: 500 }
    );
  }
}

/**
 * Helper: Update zone state after an approved proposal
 */
async function updateZoneStateAfterApproval(
  proposal_id: string,
  db: any
): Promise<void> {
  const proposal = await db
    .collection("proposals_log")
    .findOne({ proposal_id });

  if (!proposal) return;

  // Simulate pressure changes after transfer
  const source = await db.collection("zones").findOne({
    zone_id: proposal.source_zone,
  });
  const dest = await db.collection("zones").findOne({
    zone_id: proposal.dest_zone,
  });

  // Update consumption states (in production, might trigger hydraulic sim)
  if (source && dest) {
    await db.collection("zones").updateOne(
      { zone_id: proposal.source_zone },
      {
        $set: {
          current_supply: source.current_supply - proposal.volume,
          last_proposal_id: proposal_id,
        },
      }
    );

    await db.collection("zones").updateOne(
      { zone_id: proposal.dest_zone },
      {
        $set: {
          current_supply: dest.current_supply + proposal.volume,
          last_proposal_id: proposal_id,
        },
      }
    );
  }
}
