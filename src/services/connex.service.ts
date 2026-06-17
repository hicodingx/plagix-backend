import {prisma} from "../../lib/prisma.js"

export const checkConnexionToDB = async () => {
  try {
    await prisma.$connect(); // Teste la connexion
    console.log("Database connected successfully.");
  } catch (error) {
    throw new Error("Failed to connect to the database");
    
  }
};
